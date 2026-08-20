import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useConfirm } from "../context/ConfirmContext";
import { useGlobalContext } from "../context/GlobalContext";
import { useToast } from "../context/ToastContext";
import tangibleAssetService from "../services/tangibleAssetService";
import transactionService from "../services/transactionService/transactionService";
import InvestmentChart from "./dashboard/investmentChart";
import TransactionPopup from "./core/transaction_popup";
import TransactionComposer from "./core/transactionComposer";
import "./assets.scss";

const TYPES = [
  "real_estate",
  "vehicle",
  "precious_metal",
  "art",
  "collectible",
  "other",
];
const METALS = ["gold", "silver", "platinum", "palladium", "other"];
const SECURITY_CLASSES = [
  "equity",
  "fixed_income",
  "money_market",
  "commodity",
  "real_estate",
  "mixed",
  "other",
];
const TYPE_META = {
  real_estate: { code: "RE", label: "Real estate" },
  vehicle: { code: "VE", label: "Vehicle" },
  precious_metal: { code: "PM", label: "Precious metal" },
  art: { code: "AR", label: "Art" },
  collectible: { code: "CO", label: "Collectible" },
  other: { code: "OT", label: "Other" },
};
const today = () => new Date().toISOString().slice(0, 10);
const titleCase = (value = "") =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const money = (currency, value) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
const decimal = (value, maximumFractionDigits = 4) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(
    Number(value || 0)
  );
const price = (currency, value) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: 4,
  }).format(Number(value || 0));
const accountOptions = (accounts) =>
  accounts
    .filter((account) => (account.cash_balances || []).length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
const balancesForAccount = (accounts, accountId) =>
  accounts.find((account) => Number(account.id) === Number(accountId))
    ?.cash_balances || [];
const autoBalanceId = (accounts, accountId) => {
  const balances = balancesForAccount(accounts, accountId);
  if (balances.length === 1) return String(balances[0].id);
  const positive = balances.filter(
    (balance) => Number(balance.balance || 0) > 0
  );
  return positive.length === 1 ? String(positive[0].id) : "";
};
const balanceLabel = (balance) =>
  `${balance.currency?.code || ""} (${money(
    balance.currency?.code,
    balance.balance
  )})`;

export default function Assets() {
  const global = useGlobalContext();
  const showConfirm = useConfirm();
  const showToast = useToast();
  const [data, setData] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [workspaceTab, setWorkspaceTab] = useState("portfolio");
  const [assetKind, setAssetKind] = useState("all");
  const [activity, setActivity] = useState([]);
  const [activityCount, setActivityCount] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(25);
  const [activityLoading, setActivityLoading] = useState(false);
  const [selectedSecurity, setSelectedSecurity] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [units, setUnits] = useState([]);
  const [status, setStatus] = useState("active");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("newest");
  const [selected, setSelected] = useState(null);
  const [composer, setComposer] = useState(null);
  const [securityComposer, setSecurityComposer] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [next, portfolioData] = await Promise.all([
        tangibleAssetService.list({
          status: "all",
          currency: global.globalCurrency,
        }),
        tangibleAssetService.portfolio(global.globalCurrency),
      ]);
      const tangiblePositions = new Map(
        (portfolioData.tangible_assets || []).map((asset) => [asset.id, asset])
      );
      const nextAssets = {
        ...next,
        assets: next.assets.map((asset) => ({
          ...asset,
          current_value_converted: tangiblePositions.get(asset.id)
            ?.current_value_converted,
        })),
      };
      setData(nextAssets);
      setPortfolio(portfolioData);
      setError("");
      setSelected((current) =>
        current
          ? nextAssets.assets.find((asset) => asset.id === current.id) || null
          : null
      );
    } catch (err) {
      setError(err.response?.data?.error || "Could not load assets.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh();
  }, [global.globalCurrency]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    tangibleAssetService
      .units()
      .then(setUnits)
      .catch(() => setUnits([]));
  }, []);
  useEffect(() => {
    setActivityPage(1);
  }, [assetKind, query, activityPageSize]);
  useEffect(() => {
    if (workspaceTab !== "activity") return undefined;
    let active = true;
    setActivityLoading(true);
    tangibleAssetService
      .activity({
        kind: assetKind,
        query,
        include_drafts: "true",
        limit: activityPageSize,
        offset: (activityPage - 1) * activityPageSize,
      })
      .then((result) => {
        if (!active) return;
        setActivity(result.results || []);
        setActivityCount(result.count || 0);
      })
      .catch(() => {
        if (!active) return;
        setActivity([]);
        setActivityCount(0);
      })
      .finally(() => active && setActivityLoading(false));
    return () => {
      active = false;
    };
  }, [workspaceTab, assetKind, query, activityPage, activityPageSize]);

  const counts = useMemo(
    () =>
      (data?.assets || []).reduce(
        (result, asset) => ({
          ...result,
          [asset.status]: (result[asset.status] || 0) + 1,
        }),
        {}
      ),
    [data]
  );
  const assets = useMemo(
    () =>
      (data?.assets || [])
        .filter((asset) => {
          const haystack = [
            asset.name,
            asset.asset_type_display,
            asset.metal_type_display,
            asset.metal_name,
          ]
            .join(" ")
            .toLowerCase();
          return (
            assetKind !== "security" &&
            (status === "all" || asset.status === status) &&
            (type === "all" || asset.asset_type === type) &&
            haystack.includes(query.toLowerCase())
          );
        })
        .sort((a, b) => {
          if (sort === "value")
            return Number(b.current_value) - Number(a.current_value);
          if (sort === "oldest")
            return a.acquired_on.localeCompare(b.acquired_on);
          if (sort === "name") return a.name.localeCompare(b.name);
          return b.acquired_on.localeCompare(a.acquired_on) || b.id - a.id;
        }),
    [data, status, type, sort, query, assetKind]
  );
  const securityPositions = useMemo(
    () =>
      (portfolio?.security_positions || [])
        .filter((position) => {
          const haystack =
            `${position.ticker} ${position.name} ${position.asset_class_label}`.toLowerCase();
          return (
            status !== "sold" &&
            status !== "disposed" &&
            assetKind !== "tangible" &&
            haystack.includes(query.toLowerCase()) &&
            (type === "all" || position.asset_class === type)
          );
        })
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "pnl"
            ? b.unrealized_pnl - a.unrealized_pnl
            : b.current_value - a.current_value
        ),
    [portfolio, assetKind, query, type, sort, status]
  );

  const complete = async (message) => {
    await global.updateAccounts();
    await refresh();
    if (message) showToast(message);
  };
  const dispose = (asset) =>
    showConfirm(
      `Dispose ${asset.name}? This removes it from net worth and does not move cash.`,
      async () => {
        await tangibleAssetService.dispose(asset.id, {
          date: today(),
          reason: "Disposed",
        });
        await complete("Asset disposed.");
      },
      { variant: "danger", confirmLabel: "Dispose" }
    );
  const undo = (asset) =>
    showConfirm(
      `Undo the latest event for ${asset.name}? Cash and ownership will be restored where applicable.`,
      async () => {
        await tangibleAssetService.undo(asset.id);
        await complete("Asset event undone.");
      },
      { variant: "info", confirmLabel: "Undo" }
    );
  const remove = (asset) =>
    showConfirm(
      `Delete imported asset ${asset.name}?`,
      async () => {
        await tangibleAssetService.remove(asset.id);
        setSelected(null);
        await complete("Asset deleted.");
      },
      { variant: "danger", confirmLabel: "Delete" }
    );

  return (
    <main className="assets-page">
      <header className="assets-hero">
        <div>
          <p className="eyebrow">Portfolio workspace</p>
          <h1>Assets</h1>
          <p>
            Track the things you own, their value, and every lifecycle event.
          </p>
        </div>
        <div className="assets-hero__value">
          <span>Total portfolio assets</span>
          <strong>
            {money(portfolio?.currency, portfolio?.summary?.total)}
          </strong>
          <small>
            {money(portfolio?.currency, portfolio?.summary?.investments)}{" "}
            investments ·{" "}
            {money(portfolio?.currency, portfolio?.summary?.tangible_assets)}{" "}
            tangible
          </small>
        </div>
        <button
          className="assets-primary-button"
          onClick={() => setComposer("choose")}
        >
          + Add asset
        </button>
      </header>
      {error && (
        <div className="assets-alert" role="alert">
          {error}
        </div>
      )}
      <section className="asset-allocation" aria-label="Asset allocation">
        {(portfolio?.allocation?.groups || [])
          .filter((item) => item.amount > 0)
          .map((item) => (
            <button
              key={item.key}
              className={`allocation-chip ${
                assetKind ===
                (item.key === "investments" ? "security" : "tangible")
                  ? "is-active"
                  : ""
              }`}
              onClick={() =>
                setAssetKind(
                  assetKind ===
                    (item.key === "investments" ? "security" : "tangible")
                    ? "all"
                    : item.key === "investments"
                    ? "security"
                    : "tangible"
                )
              }
            >
              <span className="asset-glyph">
                {item.key === "investments" ? "SEC" : "TAN"}
              </span>
              <span>
                {item.label}
                <b>{money(portfolio?.currency, item.amount)}</b>
              </span>
            </button>
          ))}
      </section>
      <nav className="asset-workspace-tabs">
        <button
          className={workspaceTab === "portfolio" ? "is-active" : ""}
          onClick={() => setWorkspaceTab("portfolio")}
        >
          Portfolio
        </button>
        <button
          className={workspaceTab === "performance" ? "is-active" : ""}
          onClick={() => setWorkspaceTab("performance")}
        >
          Performance
        </button>
        <button
          className={workspaceTab === "activity" ? "is-active" : ""}
          onClick={() => setWorkspaceTab("activity")}
        >
          Activity
        </button>
      </nav>
      {workspaceTab === "portfolio" && (
        <section className="assets-toolbar" aria-label="Asset controls">
          <div
            className="assets-segments"
            role="group"
            aria-label="Asset status"
          >
            {["active", "sold", "disposed", "all"].map((item) => (
              <button
                key={item}
                className={status === item ? "is-active" : ""}
                onClick={() => setStatus(item)}
              >
                {titleCase(item)}{" "}
                <span>
                  {item === "all"
                    ? data?.assets?.length || 0
                    : counts[item] || 0}
                </span>
              </button>
            ))}
          </div>
          <div className="assets-toolbar__filters">
            <input
              aria-label="Search assets"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ticker, stock, or asset"
            />
            <select
              aria-label="Asset kind"
              value={assetKind}
              onChange={(event) => {
                setAssetKind(event.target.value);
                setType("all");
              }}
            >
              <option value="all">All assets</option>
              <option value="security">Securities</option>
              <option value="tangible">Tangible</option>
            </select>
            <select
              aria-label="Filter by type"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="all">All types/classes</option>
              {assetKind !== "security" &&
                TYPES.map((item) => (
                  <option key={`tangible:${item}`} value={item}>
                    {titleCase(item)}
                  </option>
                ))}
              {assetKind !== "tangible" &&
                SECURITY_CLASSES.map((item) => (
                  <option key={`security:${item}`} value={item}>
                    {titleCase(item)}
                  </option>
                ))}
            </select>
            <select
              aria-label="Sort assets"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="value">Highest value</option>
              <option value="pnl">Highest P&amp;L</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name</option>
            </select>
          </div>
        </section>
      )}
      {workspaceTab === "portfolio" &&
        (loading ? (
          <div className="assets-state">Loading portfolio…</div>
        ) : assets.length || securityPositions.length ? (
          <section className="assets-portfolio-content">
            {securityPositions.length > 0 && (
              <SecurityPositionList
                positions={securityPositions}
                currency={portfolio.currency}
                onOpen={setSelectedSecurity}
                onSell={(position) => {
                  setSelectedSecurity(null);
                  setSecurityComposer({
                    type: "sell",
                    holding:
                      position.holdings.length === 1
                        ? position.holdings[0].holding_id
                        : "",
                  });
                }}
              />
            )}
            {assets.length > 0 && (
              <section className="asset-card-grid">
                {assets.map((asset) => (
                  <AssetCard
                    key={`tangible:${asset.id}`}
                    asset={asset}
                    displayCurrency={
                      asset.status === "active"
                        ? portfolio?.currency
                        : asset.currency?.code
                    }
                    displayValue={
                      asset.status === "active"
                        ? asset.current_value_converted
                        : asset.current_value
                    }
                    onOpen={() => setSelected(asset)}
                    onDispose={() => dispose(asset)}
                    onUndo={() => undo(asset)}
                  />
                ))}
              </section>
            )}
          </section>
        ) : (
          <section className="assets-state">
            <strong>No matching assets</strong>
            <p>Try another filter or add your first asset.</p>
            <button onClick={() => setComposer("choose")}>Add asset</button>
          </section>
        ))}
      {workspaceTab === "performance" && (
        <section className="asset-performance">
          <h2>Securities performance</h2>
          <p>
            Market value and return for stocks, bonds, funds, and other
            securities. Tangible assets are included in allocation, not this
            historical chart.
          </p>
          <InvestmentChart />
        </section>
      )}
      {workspaceTab === "activity" && (
        <ActivityList
          rows={activity}
          count={activityCount}
          page={activityPage}
          pageSize={activityPageSize}
          loading={activityLoading}
          currency={portfolio?.currency}
          onOpen={setSelectedActivity}
          onPageChange={setActivityPage}
          onPageSizeChange={setActivityPageSize}
        />
      )}
      {composer && (
        <AssetComposer
          mode={composer}
          units={units}
          accounts={global.activeAccounts || []}
          onClose={() => setComposer(null)}
          onOpenSecurityBuy={() => {
            setComposer(null);
            setSecurityComposer({ type: "buy" });
          }}
          onComplete={async (message) => {
            setComposer(null);
            await complete(message);
          }}
        />
      )}
      {securityComposer && (
        <TransactionComposer
          initialType={securityComposer.type}
          initialHolding={securityComposer.holding}
          onClose={() => setSecurityComposer(null)}
          onComplete={async () => {
            setSecurityComposer(null);
            await complete();
          }}
        />
      )}
      {selected && (
        <AssetPanel
          asset={selected}
          units={units}
          accounts={global.activeAccounts || []}
          onClose={() => setSelected(null)}
          onRefresh={complete}
          onDispose={() => dispose(selected)}
          onUndo={() => undo(selected)}
          onDelete={() => remove(selected)}
        />
      )}
      {selectedSecurity && (
        <SecurityPanel
          position={selectedSecurity}
          currency={portfolio?.currency}
          onClose={() => setSelectedSecurity(null)}
          onSell={(position) => {
            setSelectedSecurity(null);
            setSecurityComposer({
              type: "sell",
              holding:
                position.holdings.length === 1
                  ? position.holdings[0].holding_id
                  : "",
            });
          }}
        />
      )}
      {selectedActivity && (
        <TransactionPopup
          transaction={selectedActivity}
          showPopup={setSelectedActivity}
          refreshTransactions={refresh}
          getAccountCurrency={(id) =>
            global.accounts?.find(
              (account) => Number(account.id) === Number(id)
            )?.currency || "EUR"
          }
        />
      )}
    </main>
  );
}

export function SecurityPositionList({ positions, currency, onOpen, onSell }) {
  const [expanded, setExpanded] = useState(true);
  const panelId = "security-position-list";
  return (
    <section
      className={`security-position-list${expanded ? "" : " is-collapsed"}`}
      aria-label="Security positions"
    >
      <header>
        <div>
          <p className="eyebrow">Securities</p>
          <h2>
            Current positions <span>{positions.length}</span>
          </h2>
          <p>
            Sortable from the controls above. Select a position for account
            holdings and activity.
          </p>
        </div>
        <button
          type="button"
          className="security-position-list__toggle"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((current) => !current)}
        >
          <span>{expanded ? "Hide positions" : "Show positions"}</span>
          <span aria-hidden="true">⌄</span>
        </button>
      </header>
      {expanded && (
        <div id={panelId} className="security-position-list__table">
          <div className="security-position-list__head" aria-hidden="true">
            <span>Security</span>
            <span>Class</span>
            <span>Quantity</span>
            <span>Market value</span>
            <span>Cost basis</span>
            <span>Unrealized P&amp;L</span>
            <span>Accounts</span>
            <span />
          </div>
          {positions.map((position) => (
            <div className="security-position-list__row" key={position.id}>
              <button
                className="security-position-list__identity"
                onClick={() => onOpen(position)}
                aria-label={`View ${position.ticker} details`}
              >
                <span className="asset-glyph">
                  {position.ticker?.slice(0, 3)}
                </span>
                <span>
                  <b>{position.ticker}</b>
                  <small>{position.name}</small>
                </span>
              </button>
              <span data-label="Class">{position.asset_class_label}</span>
              <span data-label="Quantity">{decimal(position.quantity)}</span>
              <strong data-label="Market value">
                {money(currency, position.current_value)}
              </strong>
              <span data-label="Cost basis">
                {money(currency, position.cost_basis)}
              </span>
              <strong
                data-label="Unrealized P&amp;L"
                className={
                  position.unrealized_pnl >= 0 ? "positive" : "negative"
                }
              >
                {position.unrealized_pnl >= 0 ? "+" : ""}
                {money(currency, position.unrealized_pnl)}
              </strong>
              <span data-label="Accounts">{position.holdings.length}</span>
              <div className="security-position-list__actions">
                <button onClick={() => onOpen(position)}>Details</button>
                <button
                  className="asset-sell-action"
                  onClick={() => onSell(position)}
                >
                  Sell
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ActivityList({
  rows,
  count,
  page,
  pageSize,
  loading,
  currency,
  onOpen,
  onPageChange,
  onPageSizeChange,
}) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const visiblePages = Array.from(
    { length: totalPages },
    (_, index) => index + 1
  ).filter(
    (item) => item === 1 || item === totalPages || Math.abs(item - page) <= 1
  );
  const showGap = (previous, current) => current - previous > 1;
  return (
    <section className="assets-activity">
      <header>
        <div>
          <h2>Buy &amp; sell activity</h2>
          <p>Security and tangible asset trades in one timeline.</p>
        </div>
        <label className="activity-page-size">
          Rows per page
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {[25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </header>
      {loading ? (
        <div className="assets-state">Loading activity…</div>
      ) : rows.length ? (
        <>
          <div className="activity-table">
            {rows.map((row) => (
              <button key={row.id} onClick={() => onOpen(row)}>
                <span>
                  <b>
                    {row.asset_kind === "security"
                      ? row.security_ticker
                      : row.tangible_asset_name}
                  </b>
                  <small>
                    {row.asset_kind === "security"
                      ? row.security_name
                      : row.tangible_asset_type}
                  </small>
                </span>
                <span>{row.date}</span>
                <span
                  className={
                    row.transaction_type === "buy" ? "positive" : "negative"
                  }
                >
                  {titleCase(row.transaction_type)}
                </span>
                <strong>{money(currency || row.currency, row.amount)}</strong>
              </button>
            ))}
          </div>
          <footer className="activity-pagination">
            <span>
              {count} {count === 1 ? "activity item" : "activity items"}
            </span>
            <div>
              <button
                type="button"
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
              >
                Previous
              </button>
              {visiblePages.map((item, index) => (
                <span key={item}>
                  {index > 0 && showGap(visiblePages[index - 1], item) && (
                    <i aria-hidden="true">…</i>
                  )}
                  <button
                    type="button"
                    aria-label={`Page ${item}`}
                    aria-current={item === page ? "page" : undefined}
                    className={item === page ? "is-active" : ""}
                    onClick={() => onPageChange(item)}
                  >
                    {item}
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => onPageChange(page + 1)}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          </footer>
        </>
      ) : (
        <div className="assets-state">
          No buy or sell activity matches these filters.
        </div>
      )}
    </section>
  );
}

function TagEditor({ tags, onChange }) {
  const [input, setInput] = useState("");
  const add = () => {
    const value = input.trim();
    if (value && !tags.includes(value)) onChange([...tags, value]);
    setInput("");
  };
  return (
    <div className="asset-tag-editor">
      <label htmlFor="asset-tag-input">Tags</label>
      <div className="asset-tag-editor__input">
        <input
          id="asset-tag-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Enter tag"
        />
        <button type="button" onClick={add}>
          + Tag
        </button>
      </div>
      {tags.length > 0 && (
        <div className="asset-tag-editor__chips">
          {tags.map((tag) => (
            <span key={tag}>
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                onClick={() => onChange(tags.filter((item) => item !== tag))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Kept as an internal fallback while older asset-session state is still readable.
// eslint-disable-next-line no-unused-vars
function SecurityTradeForm({ accounts, onComplete }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [form, setForm] = useState({ date: today() });
  const [tags, setTags] = useState([]);
  const [error, setError] = useState("");
  const sourceBalances = balancesForAccount(accounts, form.from_account);
  useEffect(() => {
    if (query.trim().length < 1) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(
      () =>
        tangibleAssetService
          .securities(query)
          .then(setOptions)
          .catch(() => setOptions([])),
      200
    );
    return () => clearTimeout(timer);
  }, [query]);
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await transactionService.addTransaction({
        type: 3,
        security: form.security || query.trim().split(/[\s—]/)[0],
        from_cash_balance: Number(form.from_cash_balance),
        quantity: form.quantity,
        price_per_unit: form.price_per_unit,
        date: form.date,
        description: form.description || "",
        tags: tags.map((name) => ({ name })),
      });
      onComplete("Security purchased.");
    } catch (err) {
      setError(
        err.response?.data?.security ||
          err.response?.data?.from_cash_balance ||
          err.response?.data?.error ||
          "Could not buy security."
      );
    }
  };
  return (
    <form className="asset-modal-form" onSubmit={submit}>
      <label>
        Search known ticker or name
        <input
          required
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setForm({ ...form, security: "" });
          }}
          placeholder="e.g. AAPL or Apple"
        />
      </label>
      {options.length > 0 && (
        <div className="security-search-results">
          {options.map((option) => (
            <button
              type="button"
              key={option.id}
              onClick={() => {
                setQuery(`${option.ticker} — ${option.name}`);
                setForm({ ...form, security: option.id });
              }}
            >
              {option.ticker}{" "}
              <span>
                {option.name} · {option.currency.code}
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="asset-form-hint">
        A ticker not found locally will be created using the funding balance
        currency.
      </p>
      <div className="asset-form-row">
        <label>
          Source account
          <select
            required
            value={form.from_account || ""}
            onChange={(event) => {
              const from_account = event.target.value;
              setForm({
                ...form,
                from_account,
                from_cash_balance: autoBalanceId(accounts, from_account),
              });
            }}
          >
            <option value="">Select account</option>
            {accountOptions(accounts).map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Source cash balance
          <select
            required
            disabled={!form.from_account}
            value={form.from_cash_balance || ""}
            onChange={(event) =>
              setForm({ ...form, from_cash_balance: event.target.value })
            }
          >
            <option value="">Select balance</option>
            {sourceBalances.map((balance) => (
              <option key={balance.id} value={balance.id}>
                {balanceLabel(balance)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="asset-form-row">
        <label>
          Date
          <input
            required
            type="date"
            value={form.date}
            onChange={(event) => setForm({ ...form, date: event.target.value })}
          />
        </label>
        <label>
          Quantity
          <input
            required
            type="number"
            min="0.00000001"
            step="any"
            value={form.quantity || ""}
            onChange={(event) =>
              setForm({ ...form, quantity: event.target.value })
            }
          />
        </label>
      </div>
      <label>
        Price per unit
        <input
          required
          type="number"
          min="0.00000001"
          step="any"
          value={form.price_per_unit || ""}
          onChange={(event) =>
            setForm({ ...form, price_per_unit: event.target.value })
          }
        />
      </label>
      <label>
        Description
        <textarea
          value={form.description || ""}
          onChange={(event) =>
            setForm({ ...form, description: event.target.value })
          }
        />
      </label>
      <TagEditor tags={tags} onChange={setTags} />
      {error && (
        <p className="asset-form-error">
          {Array.isArray(error) ? error.join(" ") : String(error)}
        </p>
      )}
      <button className="assets-primary-button" type="submit">
        Buy security
      </button>
    </form>
  );
}

function SecurityPanel({ position, currency, onClose, onSell }) {
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const key = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <aside
      className="asset-panel"
      aria-label={`${position.ticker} position details`}
    >
      <div className="asset-panel__backdrop" onClick={onClose} />
      <section className="asset-panel__sheet">
        <header>
          <div>
            <span className="asset-glyph asset-glyph--large">
              {position.ticker?.slice(0, 3)}
            </span>
            <div>
              <p className="eyebrow">{position.asset_class_label}</p>
              <h2>
                {position.ticker} · {position.name}
              </h2>
            </div>
          </div>
          <button
            ref={closeRef}
            className="asset-icon-button"
            aria-label="Close security details"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="asset-panel__value">
          <span>Market value</span>
          <strong>{money(currency, position.current_value)}</strong>
          <span
            className={position.unrealized_pnl >= 0 ? "positive" : "negative"}
          >
            {position.unrealized_pnl >= 0 ? "+" : ""}
            {money(currency, position.unrealized_pnl)} P&amp;L
          </span>
        </div>
        <section className="asset-panel__content asset-overview">
          <dl>
            <div>
              <dt>Quantity</dt>
              <dd>{decimal(position.quantity)}</dd>
            </div>
            <div>
              <dt>Cost basis</dt>
              <dd>{money(currency, position.cost_basis)}</dd>
            </div>
            <div>
              <dt>Latest price</dt>
              <dd>
                {price(position.security_currency, position.latest_price)}
              </dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{position.security_currency}</dd>
            </div>
          </dl>
          <div className="asset-notes">
            <h3>Account holdings</h3>
            {position.holdings.map((holding) => (
              <p key={holding.holding_id}>
                {holding.account_name}: {decimal(holding.quantity)} units
              </p>
            ))}
          </div>
        </section>
        <footer className="asset-panel__actions">
          <button
            className="asset-sell-action"
            onClick={() => onSell(position)}
          >
            Sell security
          </button>
        </footer>
      </section>
    </aside>
  );
}

// eslint-disable-next-line no-unused-vars
function SecuritySellForm({ position, accounts, onClose, onComplete }) {
  const [form, setForm] = useState({
    date: today(),
    holding:
      position.holdings.length === 1 ? position.holdings[0].holding_id : "",
  });
  const [tags, setTags] = useState([]);
  const [error, setError] = useState("");
  const destinationBalances = balancesForAccount(accounts, form.to_account);
  const submit = async (event) => {
    event.preventDefault();
    try {
      await transactionService.addTransaction({
        type: 4,
        holding: Number(form.holding),
        to_cash_balance: Number(form.to_cash_balance),
        quantity: form.quantity,
        price_per_unit: form.price_per_unit,
        date: form.date,
        description: form.description || "",
        tags: tags.map((name) => ({ name })),
      });
      onComplete();
    } catch (err) {
      setError(
        err.response?.data?.quantity ||
          err.response?.data?.to_cash_balance ||
          err.response?.data?.error ||
          "Could not sell security."
      );
    }
  };
  return (
    <Modal title={`Sell ${position.ticker}`} onClose={onClose}>
      <form className="asset-modal-form" onSubmit={submit}>
        <label>
          Holding
          <select
            required
            value={form.holding}
            onChange={(event) =>
              setForm({ ...form, holding: event.target.value })
            }
          >
            <option value="">Select account holding</option>
            {position.holdings.map((holding) => (
              <option key={holding.holding_id} value={holding.holding_id}>
                {holding.account_name} — {decimal(holding.quantity)} units
              </option>
            ))}
          </select>
        </label>
        <div className="asset-form-row">
          <label>
            Destination account
            <select
              required
              value={form.to_account || ""}
              onChange={(event) => {
                const to_account = event.target.value;
                setForm({
                  ...form,
                  to_account,
                  to_cash_balance: autoBalanceId(accounts, to_account),
                });
              }}
            >
              <option value="">Select account</option>
              {accountOptions(accounts).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Destination cash balance
            <select
              required
              disabled={!form.to_account}
              value={form.to_cash_balance || ""}
              onChange={(event) =>
                setForm({ ...form, to_cash_balance: event.target.value })
              }
            >
              <option value="">Select balance</option>
              {destinationBalances.map((balance) => (
                <option key={balance.id} value={balance.id}>
                  {balanceLabel(balance)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="asset-form-row">
          <label>
            Date
            <input
              required
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm({ ...form, date: event.target.value })
              }
            />
          </label>
          <label>
            Quantity
            <input
              required
              type="number"
              min="0.00000001"
              step="any"
              value={form.quantity || ""}
              onChange={(event) =>
                setForm({ ...form, quantity: event.target.value })
              }
            />
          </label>
        </div>
        <label>
          Price per unit
          <input
            required
            type="number"
            min="0.00000001"
            step="any"
            value={form.price_per_unit || ""}
            onChange={(event) =>
              setForm({ ...form, price_per_unit: event.target.value })
            }
          />
        </label>
        <label>
          Description
          <textarea
            value={form.description || ""}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </label>
        <TagEditor tags={tags} onChange={setTags} />
        {error && (
          <p className="asset-form-error">
            {Array.isArray(error) ? error.join(" ") : String(error)}
          </p>
        )}
        <button className="assets-primary-button" type="submit">
          Sell security
        </button>
      </form>
    </Modal>
  );
}

function AssetCard({
  asset,
  displayCurrency,
  displayValue,
  onOpen,
  onDispose,
  onUndo,
}) {
  const meta = TYPE_META[asset.asset_type] || TYPE_META.other;
  const physical =
    asset.asset_type === "precious_metal"
      ? `${
          asset.metal_type === "other"
            ? asset.metal_name
            : asset.metal_type_display || "Unclassified"
        } · ${decimal(asset.quantity)} ${asset.unit?.symbol || ""}`
      : null;
  return (
    <article
      className="asset-card"
      tabIndex="0"
      onKeyDown={(event) => event.key === "Enter" && onOpen()}
    >
      <button className="asset-card__main" onClick={onOpen}>
        <span className="asset-glyph asset-glyph--large">{meta.code}</span>
        <span className="asset-card__heading">
          <span>
            <b>{asset.name}</b>
            <small>{asset.asset_type_display}</small>
          </span>
          <strong>{money(displayCurrency, displayValue)}</strong>
        </span>
      </button>
      <div className="asset-card__metadata">
        <span>Acquired {asset.acquired_on}</span>
        {physical && <span>{physical}</span>}
        {asset.asset_type === "real_estate" && asset.address && (
          <span>{asset.address}</span>
        )}
      </div>
      <footer>
        <span className={`asset-status asset-status--${asset.status}`}>
          {titleCase(asset.status)}
        </span>
        <div>
          <button onClick={onOpen}>Details</button>
          {asset.status === "active" ? (
            <button className="asset-card__danger" onClick={onDispose}>
              Dispose
            </button>
          ) : (
            <button onClick={onUndo}>Undo</button>
          )}
        </div>
      </footer>
    </article>
  );
}

function AssetComposer({
  mode,
  units,
  accounts,
  onClose,
  onComplete,
  onOpenSecurityBuy,
}) {
  const [currentMode, setCurrentMode] = useState(mode);
  const [form, setForm] = useState({
    asset_type: "real_estate",
    property_type: "residential",
    acquired_on: today(),
    date: today(),
    quantity: "1",
  });
  const [errors, setErrors] = useState({});
  const massUnits = units.filter((unit) => unit.dimension === "mass");
  const balances = accounts.flatMap((account) =>
    (account.cash_balances || []).map((balance) => ({
      ...balance,
      accountName: account.name,
    }))
  );
  const currencies = balances.filter(
    (balance, index, all) =>
      all.findIndex((item) => item.currency.id === balance.currency.id) ===
      index
  );
  const set = (event) =>
    setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    setErrors({});
    const payload = { ...form };
    if (payload.asset_type !== "real_estate") {
      delete payload.property_type;
      delete payload.address;
    }
    if (payload.asset_type !== "precious_metal") {
      delete payload.metal_type;
      delete payload.metal_name;
      delete payload.unit_id;
    }
    if (payload.asset_type === "precious_metal" && !payload.name)
      payload.name = `${
        payload.metal_type === "other"
          ? payload.metal_name
          : titleCase(payload.metal_type)
      } holding`;
    try {
      if (currentMode === "buy") {
        payload.amount = payload.acquisition_cost;
        await tangibleAssetService.purchase(payload);
      } else {
        await tangibleAssetService.create(payload);
      }
      onComplete(
        currentMode === "buy" ? "Asset purchased." : "Asset imported."
      );
    } catch (err) {
      setErrors(err.response?.data || { form: "Could not save asset." });
    }
  };
  return (
    <Modal
      title={
        currentMode === "choose"
          ? "Add an asset"
          : currentMode === "security"
          ? "Buy a security"
          : currentMode === "buy"
          ? "Buy a tangible asset"
          : "Import existing asset"
      }
      onClose={onClose}
    >
      {currentMode === "choose" ? (
        <div className="asset-mode-choice">
          <button onClick={onOpenSecurityBuy}>
            <b>Buy a security</b>
            <span>Buy a stock, bond, fund, or other known ticker.</span>
          </button>
          <button onClick={() => setCurrentMode("buy")}>
            <b>Buy tangible asset</b>
            <span>
              Create a normal Buy transaction and debit a cash balance.
            </span>
          </button>
          <button onClick={() => setCurrentMode("import")}>
            <b>Import existing tangible</b>
            <span>
              Record something you already own, with no cash movement.
            </span>
          </button>
        </div>
      ) : (
        <form className="asset-modal-form" onSubmit={submit}>
          <div className="asset-form-mode">
            <button
              type="button"
              className={currentMode === "buy" ? "is-active" : ""}
              onClick={() => setCurrentMode("buy")}
            >
              Buy tangible
            </button>
            <button
              type="button"
              className={currentMode === "import" ? "is-active" : ""}
              onClick={() => setCurrentMode("import")}
            >
              Import existing
            </button>
          </div>
          <AssetFields
            form={form}
            set={set}
            units={massUnits}
            isBuy={currentMode === "buy"}
            currencies={currencies}
            balances={balances}
            errors={errors}
          />
          <p className="asset-form-error">{errors.detail || errors.form}</p>
          <button className="assets-primary-button" type="submit">
            {currentMode === "buy" ? "Buy asset" : "Import asset"}
          </button>
        </form>
      )}
    </Modal>
  );
}

function AssetFields({
  form,
  set,
  units,
  isBuy,
  currencies,
  balances,
  errors = {},
}) {
  const metal = form.asset_type === "precious_metal";
  return (
    <>
      <label>
        Asset type
        <select name="asset_type" value={form.asset_type} onChange={set}>
          {TYPES.map((item) => (
            <option key={item} value={item}>
              {titleCase(item)}
            </option>
          ))}
        </select>
      </label>
      {!metal && (
        <label>
          {form.asset_type === "real_estate" ? "Property name" : "Asset name"}
          <input required name="name" value={form.name || ""} onChange={set} />
        </label>
      )}
      {form.asset_type === "real_estate" && (
        <>
          <label>
            Property type
            <select
              name="property_type"
              value={form.property_type}
              onChange={set}
            >
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="land">Land</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Address
            <input name="address" value={form.address || ""} onChange={set} />
          </label>
        </>
      )}
      {metal && (
        <>
          <label>
            Metal
            <select
              required
              name="metal_type"
              value={form.metal_type || ""}
              onChange={set}
            >
              <option value="">Select metal</option>
              {METALS.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </select>
          </label>
          {form.metal_type === "other" && (
            <label>
              Metal name
              <input
                required
                name="metal_name"
                value={form.metal_name || ""}
                onChange={set}
              />
            </label>
          )}
          <div className="asset-form-row">
            <label>
              Quantity
              <input
                required
                type="number"
                min="0.00000001"
                step="any"
                name="quantity"
                value={form.quantity || ""}
                onChange={set}
              />
            </label>
            <label>
              Unit
              <select
                required
                name="unit_id"
                value={form.unit_id || ""}
                onChange={set}
              >
                <option value="">Select unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.symbol})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}
      <div className="asset-form-row">
        <label>
          {isBuy ? "Purchase date" : "Acquired on"}
          <input
            required
            type="date"
            name={isBuy ? "date" : "acquired_on"}
            value={isBuy ? form.date : form.acquired_on}
            onChange={set}
          />
        </label>
        <label>
          {isBuy ? "Purchase price" : "Acquisition cost"}
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            name="acquisition_cost"
            value={form.acquisition_cost || ""}
            onChange={set}
          />
        </label>
      </div>
      {isBuy ? (
        <label>
          Pay from cash balance
          <select
            required
            name="from_cash_balance"
            value={form.from_cash_balance || ""}
            onChange={set}
          >
            <option value="">Select cash balance</option>
            {balances.map((balance) => (
              <option key={balance.id} value={balance.id}>
                {balance.accountName} — {balance.currency.code}{" "}
                {money(balance.currency.code, balance.balance)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label>
          Currency
          <select
            required
            name="currency_id"
            value={form.currency_id || ""}
            onChange={set}
          >
            <option value="">Select currency</option>
            {currencies.map((balance) => (
              <option key={balance.currency.id} value={balance.currency.id}>
                {balance.currency.code}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Notes
        <textarea name="notes" value={form.notes || ""} onChange={set} />
      </label>
      {Object.entries(errors)
        .filter(([key]) => !["detail", "form"].includes(key))
        .map(([key, value]) => (
          <p className="asset-field-error" key={key}>
            {key}: {Array.isArray(value) ? value.join(" ") : String(value)}
          </p>
        ))}
    </>
  );
}

function AssetPanel({
  asset,
  accounts,
  onClose,
  onRefresh,
  onDispose,
  onUndo,
  onDelete,
}) {
  const [tab, setTab] = useState("overview");
  const [valuations, setValuations] = useState([]);
  const [action, setAction] = useState(null);
  const showConfirm = useConfirm();
  const showToast = useToast();
  const closeRef = useRef(null);
  const refreshValues = async () =>
    setValuations(await tangibleAssetService.valuations(asset.id));
  useEffect(() => {
    refreshValues().catch(() => setValuations([]));
    closeRef.current?.focus();
  }, [asset.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const key = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  const revalue = async (payload) => {
    await tangibleAssetService.addValuation(asset.id, payload);
    await refreshValues();
    await onRefresh("Valuation saved.");
    setAction(null);
  };
  const sell = async (payload) => {
    await tangibleAssetService.sell(asset.id, payload);
    await onRefresh("Asset sold.");
    setAction(null);
  };
  const edit = async (payload) => {
    await tangibleAssetService.update(asset.id, payload);
    await onRefresh("Asset details updated.");
    setAction(null);
  };
  const deleteValuation = (valuation) =>
    showConfirm(
      `Delete the ${valuation.date} valuation?`,
      async () => {
        await tangibleAssetService.deleteValuation(asset.id, valuation.id);
        await refreshValues();
        await onRefresh("Valuation deleted.");
      },
      { variant: "danger", confirmLabel: "Delete" }
    );
  return (
    <aside className="asset-panel" aria-label={`${asset.name} details`}>
      <div className="asset-panel__backdrop" onClick={onClose} />
      <section className="asset-panel__sheet">
        <header>
          <div>
            <span className="asset-glyph asset-glyph--large">
              {TYPE_META[asset.asset_type]?.code}
            </span>
            <div>
              <p className="eyebrow">{asset.asset_type_display}</p>
              <h2>{asset.name}</h2>
            </div>
          </div>
          <button
            ref={closeRef}
            className="asset-icon-button"
            aria-label="Close asset details"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="asset-panel__value">
          <span>Current value</span>
          <strong>{money(asset.currency?.code, asset.current_value)}</strong>
          <span className={`asset-status asset-status--${asset.status}`}>
            {titleCase(asset.status)}
          </span>
        </div>
        <nav className="asset-panel__tabs">
          <button
            className={tab === "overview" ? "is-active" : ""}
            onClick={() => setTab("overview")}
          >
            Overview
          </button>
          <button
            className={tab === "valuations" ? "is-active" : ""}
            onClick={() => setTab("valuations")}
          >
            Valuations
          </button>
          <button
            className={tab === "activity" ? "is-active" : ""}
            onClick={() => setTab("activity")}
          >
            Activity
          </button>
        </nav>
        {tab === "overview" && <AssetOverview asset={asset} />}
        {tab === "valuations" && (
          <section className="asset-panel__content">
            <div className="asset-section-heading">
              <h3>Valuation history</h3>
              {asset.status === "active" && (
                <button onClick={() => setAction("revalue")}>+ Revalue</button>
              )}
            </div>
            {valuations.length ? (
              <div className="valuation-list">
                {valuations.map((valuation) => (
                  <div key={valuation.id}>
                    <span>
                      <b>{money(asset.currency?.code, valuation.value)}</b>
                      <small>
                        {valuation.date} · {titleCase(valuation.source)}
                      </small>
                    </span>
                    {valuation.source === "manual" &&
                      valuation.id === valuations[0]?.id && (
                        <button onClick={() => deleteValuation(valuation)}>
                          Remove
                        </button>
                      )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No valuations yet.</p>
            )}
          </section>
        )}
        {tab === "activity" && <AssetActivity asset={asset} />}
        {asset.status === "active" ? (
          <footer className="asset-panel__actions">
            <button onClick={() => setAction("edit")}>Edit</button>
            <button onClick={() => setAction("revalue")}>Revalue</button>
            <button onClick={() => setAction("sell")}>Sell</button>
            <button className="danger" onClick={onDispose}>
              Dispose
            </button>
          </footer>
        ) : (
          <footer className="asset-panel__actions">
            <button onClick={onUndo}>Undo last event</button>
          </footer>
        )}
        {action === "edit" && (
          <EditAssetForm
            asset={asset}
            onClose={() => setAction(null)}
            onSubmit={edit}
          />
        )}
        {action === "revalue" && (
          <ActionForm
            title="Revalue asset"
            onClose={() => setAction(null)}
            onSubmit={revalue}
          >
            <label>
              Date
              <input required type="date" name="date" defaultValue={today()} />
            </label>
            <label>
              Total value
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                name="value"
              />
            </label>
            <label>
              Notes
              <textarea name="notes" />
            </label>
          </ActionForm>
        )}
        {action === "sell" && (
          <SellForm
            asset={asset}
            accounts={accounts}
            onClose={() => setAction(null)}
            onSubmit={sell}
            showToast={showToast}
          />
        )}
      </section>
    </aside>
  );
}

function AssetOverview({ asset }) {
  const physical =
    asset.asset_type === "precious_metal"
      ? `${
          asset.metal_type === "other"
            ? asset.metal_name
            : asset.metal_type_display || "Unclassified"
        } · ${decimal(asset.quantity)} ${asset.unit?.name || ""}`
      : null;
  return (
    <section className="asset-panel__content asset-overview">
      <dl>
        <div>
          <dt>Acquired</dt>
          <dd>{asset.acquired_on}</dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd>{money(asset.currency?.code, asset.acquisition_cost)}</dd>
        </div>
        {asset.asset_type === "real_estate" && (
          <>
            <div>
              <dt>Property type</dt>
              <dd>{asset.property_type_display}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{asset.address || "—"}</dd>
            </div>
          </>
        )}
        {physical && (
          <div>
            <dt>Holding</dt>
            <dd>{physical}</dd>
          </div>
        )}
      </dl>
      {asset.notes && (
        <div className="asset-notes">
          <h3>Notes</h3>
          <p>{asset.notes}</p>
        </div>
      )}
    </section>
  );
}
function AssetActivity({ asset }) {
  return (
    <section className="asset-panel__content">
      <div className="asset-activity">
        <div>
          <i />
          <span>
            <b>Acquired</b>
            <small>
              {asset.acquired_on} ·{" "}
              {money(asset.currency?.code, asset.acquisition_cost)}
            </small>
          </span>
        </div>
        {asset.status !== "active" && (
          <div>
            <i />
            <span>
              <b>{titleCase(asset.status)}</b>
              <small>
                {asset.disposed_on}{" "}
                {asset.disposal_reason ? `· ${asset.disposal_reason}` : ""}
              </small>
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
function EditAssetForm({ asset, onClose, onSubmit }) {
  return (
    <ActionForm
      title="Edit asset details"
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <label>
        Name
        <input required name="name" defaultValue={asset.name} />
      </label>
      {asset.asset_type === "real_estate" && (
        <>
          <label>
            Property type
            <select
              name="property_type"
              defaultValue={asset.property_type || "residential"}
            >
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="land">Land</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Address
            <input name="address" defaultValue={asset.address || ""} />
          </label>
        </>
      )}
      <label>
        Notes
        <textarea name="notes" defaultValue={asset.notes || ""} />
      </label>
    </ActionForm>
  );
}
function SellForm({ asset, accounts, onClose, onSubmit, showToast }) {
  const balances = accounts.flatMap((account) =>
    (account.cash_balances || [])
      .filter((balance) => balance.currency.id === asset.currency.id)
      .map((balance) => ({ ...balance, accountName: account.name }))
  );
  return (
    <ActionForm
      title={`Sell ${asset.name}`}
      onClose={onClose}
      onSubmit={async (payload) => {
        if (!balances.length) {
          showToast("Add a matching-currency cash balance first.", "error");
          return;
        }
        await onSubmit(payload);
      }}
    >
      <p className="asset-form-hint">
        Proceeds are credited to the selected {asset.currency.code} cash
        balance.
      </p>
      <label>
        Sale date
        <input required type="date" name="date" defaultValue={today()} />
      </label>
      <label>
        Sale proceeds
        <input required type="number" min="0.01" step="0.01" name="amount" />
      </label>
      <label>
        Deposit into
        <select required name="to_cash_balance">
          <option value="">Select cash balance</option>
          {balances.map((balance) => (
            <option key={balance.id} value={balance.id}>
              {balance.accountName} — {balance.currency.code}{" "}
              {money(balance.currency.code, balance.balance)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Description
        <textarea name="description" />
      </label>
    </ActionForm>
  );
}
function ActionForm({ title, children, onClose, onSubmit }) {
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          "Could not save changes."
      );
    }
  };
  const isSell = title.startsWith("Sell ");
  return (
    <Modal title={title} onClose={onClose}>
      <form className="asset-modal-form" onSubmit={submit}>
        {children}
        {error && <p className="asset-form-error">{error}</p>}
        <button
          className={`assets-primary-button${
            isSell ? " asset-sell-action" : ""
          }`}
          type="submit"
        >
          {isSell ? "Sell asset" : "Save"}
        </button>
      </form>
    </Modal>
  );
}
function Modal({ title, children, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const key = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  return createPortal(
    <div
      className="asset-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="asset-modal__backdrop" onClick={onClose} />
      <section className="asset-modal__sheet">
        <header>
          <h2>{title}</h2>
          <button
            ref={closeRef}
            className="asset-icon-button"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body
  );
}
