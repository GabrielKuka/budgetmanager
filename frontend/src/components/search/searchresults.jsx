import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./searchresults.scss";
import { useGlobalContext } from "../../context/GlobalContext";
import { useToast } from "../../context/ToastContext";
import searchService from "../../services/searchService";
import TransactionPopup from "../core/transaction_popup";
import { helper } from "../helper";
import {
  EmptyState,
  MetricCard,
  StatusBadge,
  Surface,
  WorkspaceHero,
  WorkspaceShell,
} from "../core/workspace";

const TYPES = ["income", "expense", "transfer", "buy", "sell"];
const GROUP_LABELS = {
  income: "Income",
  expense: "Expenses",
  transfer: "Transfers",
  buy: "Buys",
  sell: "Sells",
};

function splitParam(params, name) {
  return (params.get(name) || "").split(",").filter(Boolean);
}

function errorMessage(error) {
  return (
    error?.response?.data?.error || error?.message || "The request failed."
  );
}

const SearchResults = () => {
  const global = useGlobalContext();
  const showToast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [savedSearches, setSavedSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queryInput, setQueryInput] = useState(searchParams.get("q") || "");
  const [suggestions, setSuggestions] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [popup, setPopup] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [bulkAction, setBulkAction] = useState("set_pinned");
  const [bulkValue, setBulkValue] = useState("true");

  const currency = global.globalCurrency || "EUR";
  const paramsKey = searchParams.toString();
  const apiParams = useMemo(() => {
    const current = new URLSearchParams(paramsKey);
    return {
      ...Object.fromEntries(current.entries()),
      currency,
      page_size: current.get("page_size") || 25,
    };
  }, [paramsKey, currency]);

  useEffect(
    () => setQueryInput(new URLSearchParams(paramsKey).get("q") || ""),
    [paramsKey]
  );

  useEffect(() => {
    if (
      queryInput.trim().length < 2 ||
      queryInput === new URLSearchParams(paramsKey).get("q")
    ) {
      setSuggestions([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      searchService
        .suggestions(queryInput.trim())
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [queryInput, paramsKey]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      searchService.search(apiParams),
      searchService.insights(apiParams),
    ])
      .then(([results, insightData]) => {
        if (!active) return;
        setData(results);
        setInsights(insightData);
        setSelected([]);
      })
      .catch((requestError) => active && setError(errorMessage(requestError)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [apiParams, refreshKey]);

  useEffect(() => {
    searchService
      .getSavedSearches()
      .then(setSavedSearches)
      .catch(() => {});
  }, []);

  function updateParams(changes, resetPage = true) {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (
        value === null ||
        value === undefined ||
        value === "" ||
        (Array.isArray(value) && !value.length)
      ) {
        next.delete(key);
      } else {
        next.set(key, Array.isArray(value) ? value.join(",") : String(value));
      }
    });
    if (resetPage) next.delete("page");
    setSearchParams(next);
  }

  function toggleListValue(name, value) {
    const values = splitParam(searchParams, name);
    const next = values.includes(String(value))
      ? values.filter((item) => item !== String(value))
      : [...values, String(value)];
    updateParams({ [name]: next });
  }

  function setTypeTab(type) {
    updateParams({ types: type === "all" ? null : type });
  }

  function chooseSuggestion(suggestion) {
    const keys = {
      account: "account_ids",
      category: "category_ids",
      tag: "tag_ids",
    };
    if (keys[suggestion.kind]) {
      updateParams({ q: null, [keys[suggestion.kind]]: suggestion.id });
      setQueryInput("");
    } else {
      updateParams({ q: suggestion.label.split(" · ")[0] });
      setQueryInput(suggestion.label.split(" · ")[0]);
    }
    setSuggestions([]);
  }

  async function saveCurrentSearch() {
    const name = window.prompt("Name this search");
    if (!name?.trim()) return;
    try {
      const filters = Object.fromEntries(searchParams.entries());
      delete filters.page;
      const saved = await searchService.createSavedSearch({
        name: name.trim(),
        filters,
        sort: searchParams.get("sort") || "date_desc",
        grouping: searchParams.get("group_by") || "none",
      });
      setSavedSearches((current) =>
        [...current, saved].sort((a, b) => a.name.localeCompare(b.name))
      );
      showToast("Search saved.", "success");
    } catch (saveError) {
      showToast(errorMessage(saveError), "error");
    }
  }

  function loadSavedSearch(saved) {
    const next = new URLSearchParams(saved.filters || {});
    if (saved.sort && saved.sort !== "date_desc") next.set("sort", saved.sort);
    if (saved.grouping && saved.grouping !== "none")
      next.set("group_by", saved.grouping);
    setSearchParams(next);
  }

  async function removeSavedSearch(saved) {
    try {
      await searchService.deleteSavedSearch(saved.id);
      setSavedSearches((current) =>
        current.filter((item) => item.id !== saved.id)
      );
    } catch (deleteError) {
      showToast(errorMessage(deleteError), "error");
    }
  }

  async function renameSavedSearch(saved) {
    const name = window.prompt("Rename saved search", saved.name);
    if (!name?.trim() || name.trim() === saved.name) return;
    try {
      const updated = await searchService.updateSavedSearch(saved.id, {
        ...saved,
        name: name.trim(),
      });
      setSavedSearches((current) =>
        current
          .map((item) => (item.id === saved.id ? updated : item))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (renameError) {
      showToast(errorMessage(renameError), "error");
    }
  }

  async function runBulkAction() {
    if (!selected.length) return;
    const payload = { ids: selected, action: bulkAction };
    if (bulkAction === "set_pinned") payload.pinned = bulkValue === "true";
    if (bulkAction === "set_category") payload.category_id = Number(bulkValue);
    if (bulkAction === "add_tags" || bulkAction === "remove_tags")
      payload.tag_ids = [Number(bulkValue)];
    try {
      await searchService.bulkUpdate(payload);
      showToast(`${selected.length} transactions updated.`, "success");
      await global.updateTransactions();
      setRefreshKey((value) => value + 1);
    } catch (bulkError) {
      showToast(errorMessage(bulkError), "error");
    }
  }

  async function dismissInsight(item) {
    await searchService.dismissInsight(item.type, item.fingerprint);
    setInsights((current) => ({
      ...current,
      [item.type === "duplicate" ? "duplicates" : "recurring"]: current[
        item.type === "duplicate" ? "duplicates" : "recurring"
      ].filter((entry) => entry.fingerprint !== item.fingerprint),
    }));
  }

  function getAccountCurrency(id) {
    return (
      global.accounts?.find((account) => account.id === Number(id))?.currency ||
      "EUR"
    );
  }

  const activeType =
    splitParam(searchParams, "types").length === 1
      ? splitParam(searchParams, "types")[0]
      : "all";
  const groupBy = searchParams.get("group_by") || "none";
  const grouped = useMemo(
    () => groupResults(data?.results || [], groupBy),
    [data, groupBy]
  );
  const categories = [
    ...(global.incomeCategories || []),
    ...(global.expenseCategories || []),
  ];
  const tagOptions = data?.facets?.tags || [];
  const activeChips = buildActiveChips(searchParams);

  return (
    <WorkspaceShell className="search-page search-explorer">
      <WorkspaceHero
        eyebrow="Transaction explorer"
        title="Search your financial history"
        description={`${data?.total || 0} matching transactions in ${currency}`}
        actions={
          <div className="search-hero-actions">
            <button
              type="button"
              onClick={() => setFiltersOpen((value) => !value)}
              aria-expanded={filtersOpen}
            >
              Filters
            </button>
            <button type="button" onClick={saveCurrentSearch}>
              Save search
            </button>
            <button
              type="button"
              onClick={() => searchService.exportCsv(apiParams, selected)}
            >
              Export CSV
            </button>
          </div>
        }
      />

      <form
        className="explorer-search"
        onSubmit={(event) => {
          event.preventDefault();
          updateParams({ q: queryInput });
        }}
      >
        <input
          aria-label="Search transactions"
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder="Description, account, category, tag, ticker…"
        />
        <button type="submit">Search</button>
        {!!suggestions.length && (
          <div
            className="explorer-suggestions"
            role="listbox"
            aria-label="Search suggestions"
          >
            {suggestions.map((suggestion) => (
              <button
                type="button"
                role="option"
                aria-selected="false"
                key={`${suggestion.kind}-${suggestion.id}`}
                onClick={() => chooseSuggestion(suggestion)}
              >
                <small>{suggestion.kind}</small>
                {suggestion.label}
              </button>
            ))}
          </div>
        )}
      </form>

      {!!activeChips.length && (
        <div className="filter-chips" aria-label="Active filters">
          {activeChips.map((chip) => (
            <button
              type="button"
              key={chip.key}
              onClick={() => updateParams({ [chip.key]: null })}
            >
              {chip.label} ×
            </button>
          ))}
          <button
            type="button"
            className="clear"
            onClick={() => setSearchParams({ q: searchParams.get("q") || "" })}
          >
            Clear filters
          </button>
        </div>
      )}

      <div className="explorer-layout">
        <FilterSidebar
          open={filtersOpen}
          params={searchParams}
          accounts={global.accounts || []}
          categories={categories}
          facets={data?.facets || {}}
          updateParams={updateParams}
          toggleListValue={toggleListValue}
          savedSearches={savedSearches}
          loadSavedSearch={loadSavedSearch}
          renameSavedSearch={renameSavedSearch}
          removeSavedSearch={removeSavedSearch}
        />

        <div className="explorer-main">
          <Summary
            summary={data?.summary}
            comparison={data?.comparison}
            currency={currency}
            privacyMode={global.privacyMode}
          />

          <div
            className="type-tabs"
            role="tablist"
            aria-label="Transaction type"
          >
            {["all", ...TYPES].map((type) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeType === type}
                className={activeType === type ? "active" : ""}
                key={type}
                onClick={() => setTypeTab(type)}
              >
                {type === "all" ? "All" : GROUP_LABELS[type]}
              </button>
            ))}
          </div>

          <Surface className="result-toolbar">
            <label>
              Sort{" "}
              <select
                value={searchParams.get("sort") || "date_desc"}
                onChange={(event) => updateParams({ sort: event.target.value })}
              >
                <option value="date_desc">Newest date</option>
                <option value="date_asc">Oldest date</option>
                <option value="amount_desc">Highest amount</option>
                <option value="amount_asc">Lowest amount</option>
                <option value="created_desc">Recently created</option>
                <option value="relevance">Relevance</option>
              </select>
            </label>
            <label>
              Group{" "}
              <select
                value={groupBy}
                onChange={(event) =>
                  updateParams({ group_by: event.target.value }, false)
                }
              >
                <option value="none">None</option>
                <option value="type">Type</option>
                <option value="account">Account</option>
                <option value="category">Category</option>
                <option value="month">Month</option>
              </select>
            </label>
            {!!data?.results?.length && (
              <label className="select-page">
                <input
                  type="checkbox"
                  checked={selected.length === data.results.length}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? data.results.map((row) => row.id)
                        : []
                    )
                  }
                />{" "}
                Select page
              </label>
            )}
          </Surface>

          {!!selected.length && (
            <BulkBar
              count={selected.length}
              action={bulkAction}
              setAction={(action) => {
                setBulkAction(action);
                setBulkValue(action === "set_pinned" ? "true" : "");
              }}
              value={bulkValue}
              setValue={setBulkValue}
              categories={categories}
              tags={tagOptions}
              run={runBulkAction}
              clear={() => setSelected([])}
            />
          )}

          {loading && (
            <Surface className="search-state" aria-live="polite">
              Loading transactions and insights…
            </Surface>
          )}
          {!loading && error && (
            <EmptyState
              title="Search unavailable"
              description={error}
              action={
                <button
                  type="button"
                  onClick={() => setRefreshKey((value) => value + 1)}
                >
                  Try again
                </button>
              }
            />
          )}
          {!loading && !error && !data?.results?.length && (
            <EmptyState
              title="No matching transactions"
              description="Try a wider date range, remove a filter, or search for an account, tag, or category."
            />
          )}
          {!loading &&
            !error &&
            Object.entries(grouped).map(([label, rows]) => (
              <section className="result-group" key={label}>
                {groupBy !== "none" && (
                  <h2>
                    {label} <span>{rows.length}</span>
                  </h2>
                )}
                <div className="transaction-results">
                  {rows.map((transaction) => (
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      currency={currency}
                      privacyMode={global.privacyMode}
                      selected={selected.includes(transaction.id)}
                      toggleSelected={() =>
                        setSelected((current) =>
                          current.includes(transaction.id)
                            ? current.filter((id) => id !== transaction.id)
                            : [...current, transaction.id]
                        )
                      }
                      open={() => setPopup(transaction)}
                    />
                  ))}
                </div>
              </section>
            ))}

          {!loading && !error && data && (
            <Pagination
              page={data.page}
              pages={data.pages}
              setPage={(page) => updateParams({ page }, false)}
            />
          )}
          {!loading && !error && (
            <Analytics
              breakdowns={data?.breakdowns}
              insights={insights}
              currency={currency}
              onDismiss={dismissInsight}
              onOpen={setPopup}
              updateParams={updateParams}
            />
          )}
        </div>
      </div>

      {popup && (
        <TransactionPopup
          transaction={popup}
          showPopup={setPopup}
          getAccountCurrency={getAccountCurrency}
          refreshTransactions={async () => {
            await global.updateTransactions();
            setRefreshKey((value) => value + 1);
          }}
          refreshSearchResults={() => setRefreshKey((value) => value + 1)}
        />
      )}
    </WorkspaceShell>
  );
};

function FilterSidebar({
  open,
  params,
  accounts,
  categories,
  facets,
  updateParams,
  toggleListValue,
  savedSearches,
  loadSavedSearch,
  renameSavedSearch,
  removeSavedSearch,
}) {
  const chosenAccounts = splitParam(params, "account_ids");
  const chosenBalances = splitParam(params, "cash_balance_ids");
  const chosenCategories = splitParam(params, "category_ids");
  const chosenTags = splitParam(params, "tag_ids");
  const chosenCurrencies = splitParam(params, "currencies");
  const balances = accounts.flatMap((account) =>
    (account.cash_balances || []).map((balance) => ({
      id: balance.id,
      label: `${account.name} · ${balance.currency?.code || ""}`,
    }))
  );
  return (
    <aside
      className={`filter-sidebar ${open ? "open" : ""}`}
      aria-label="Search filters"
    >
      <Surface>
        <h2>Filters</h2>
        <label>
          From{" "}
          <input
            type="date"
            value={params.get("from_date") || ""}
            onChange={(event) =>
              updateParams({ from_date: event.target.value })
            }
          />
        </label>
        <label>
          To{" "}
          <input
            type="date"
            value={params.get("to_date") || ""}
            onChange={(event) => updateParams({ to_date: event.target.value })}
          />
        </label>
        <div className="amount-filter">
          <label>
            Min amount{" "}
            <input
              type="number"
              step="0.01"
              value={params.get("min_amount") || ""}
              onChange={(event) =>
                updateParams({ min_amount: event.target.value })
              }
            />
          </label>
          <label>
            Max amount{" "}
            <input
              type="number"
              step="0.01"
              value={params.get("max_amount") || ""}
              onChange={(event) =>
                updateParams({ max_amount: event.target.value })
              }
            />
          </label>
        </div>
        <label>
          Status{" "}
          <select
            value={params.get("draft_status") || "applied"}
            onChange={(event) =>
              updateParams({
                draft_status:
                  event.target.value === "applied" ? null : event.target.value,
              })
            }
          >
            <option value="applied">Applied</option>
            <option value="draft">Drafts</option>
            <option value="all">All</option>
          </select>
        </label>
        <label>
          Pinned{" "}
          <select
            value={params.get("pinned") || ""}
            onChange={(event) => updateParams({ pinned: event.target.value })}
          >
            <option value="">Any</option>
            <option value="true">Pinned</option>
            <option value="false">Not pinned</option>
          </select>
        </label>
        <FilterChecks
          title="Accounts"
          items={accounts.map((item) => ({ id: item.id, label: item.name }))}
          selected={chosenAccounts}
          toggle={(id) => toggleListValue("account_ids", id)}
        />
        <FilterChecks
          title="Cash balances"
          items={balances}
          selected={chosenBalances}
          toggle={(id) => toggleListValue("cash_balance_ids", id)}
        />
        <FilterChecks
          title="Categories"
          items={categories.map((item) => ({
            id: item.id,
            label: item.category,
          }))}
          selected={chosenCategories}
          toggle={(id) => toggleListValue("category_ids", id)}
        />
        <FilterChecks
          title="Tags"
          items={facets.tags || []}
          selected={chosenTags}
          toggle={(id) => toggleListValue("tag_ids", id)}
        />
        <FilterChecks
          title="Original currencies"
          items={facets.currencies || []}
          selected={chosenCurrencies}
          toggle={(id) => toggleListValue("currencies", id)}
        />
      </Surface>
      <Surface className="saved-searches">
        <h2>Saved searches</h2>
        {savedSearches.length ? (
          savedSearches.map((saved) => (
            <div key={saved.id}>
              <button type="button" onClick={() => loadSavedSearch(saved)}>
                {saved.name}
              </button>
              <button
                type="button"
                aria-label={`Rename ${saved.name}`}
                onClick={() => renameSavedSearch(saved)}
              >
                ✎
              </button>
              <button
                type="button"
                aria-label={`Delete ${saved.name}`}
                onClick={() => removeSavedSearch(saved)}
              >
                ×
              </button>
            </div>
          ))
        ) : (
          <p>No saved searches yet.</p>
        )}
      </Surface>
    </aside>
  );
}

function FilterChecks({ title, items, selected, toggle }) {
  if (!items.length) return null;
  return (
    <fieldset>
      <legend>{title}</legend>
      {items.map((item) => (
        <label key={item.id}>
          <input
            type="checkbox"
            checked={selected.includes(String(item.id))}
            onChange={() => toggle(item.id)}
          />{" "}
          {item.label}
          {item.count != null && <small>{item.count}</small>}
        </label>
      ))}
    </fieldset>
  );
}

function Summary({ summary, comparison, currency, privacyMode }) {
  const money = (value) =>
    `${helper.showOrMask(
      privacyMode,
      helper.formatNumber(value || 0)
    )} ${helper.getCurrency(currency)}`;
  const delta = comparison
    ? (summary?.net_cash_flow || 0) - (comparison.summary?.net_cash_flow || 0)
    : null;
  return (
    <div className="search-summary">
      <MetricCard
        label="Income"
        value={money(summary?.income)}
        tone="positive"
      />
      <MetricCard
        label="Expenses"
        value={money(summary?.expenses)}
        tone="negative"
      />
      <MetricCard
        label="Net cash flow"
        value={money(summary?.net_cash_flow)}
        detail={
          delta == null
            ? "Choose a date range to compare"
            : `${delta >= 0 ? "+" : ""}${helper.formatNumber(
                delta
              )} vs previous period`
        }
      />
      <MetricCard
        label="Transfers / trades"
        value={`${money(summary?.transfers)} / ${money(summary?.trade_value)}`}
        detail={`${summary?.count || 0} total matches`}
      />
    </div>
  );
}

function TransactionRow({
  transaction,
  currency,
  privacyMode,
  selected,
  toggleSelected,
  open,
}) {
  const original = `${helper.showOrMask(
    privacyMode,
    helper.formatNumber(transaction.amount)
  )} ${helper.getCurrency(transaction.currency)}`;
  const converted = `${helper.showOrMask(
    privacyMode,
    helper.formatNumber(transaction.converted_amount)
  )} ${helper.getCurrency(currency)}`;
  const accountPath =
    transaction.transaction_type === "transfer"
      ? `${transaction.from_account_name} → ${transaction.to_account_name}`
      : transaction.from_account_name || transaction.to_account_name;
  const asset = transaction.security_ticker || transaction.tangible_asset_name;
  return (
    <article className={`explorer-row type-${transaction.transaction_type}`}>
      <input
        aria-label={`Select transaction ${transaction.id}`}
        type="checkbox"
        checked={selected}
        onChange={toggleSelected}
        onClick={(event) => event.stopPropagation()}
      />
      <button type="button" className="row-main" onClick={open}>
        <span className="row-type">
          {GROUP_LABELS[transaction.transaction_type] ||
            transaction.transaction_type}
        </span>
        <span className="row-copy">
          <strong>
            {transaction.description ||
              transaction.category_name ||
              asset ||
              "No description"}
          </strong>
          <small>
            {transaction.date} · {accountPath || "No account"}
            {transaction.category_name ? ` · ${transaction.category_name}` : ""}
          </small>
          <span>
            {transaction.tags?.map((tag) => (
              <em key={tag.id}>{tag.name}</em>
            ))}
          </span>
        </span>
        <span className="row-amount">
          <strong>{original}</strong>
          {transaction.currency !== currency && <small>{converted}</small>}
        </span>
        <span className="row-status">
          {transaction.pinned && <StatusBadge>📌 Pinned</StatusBadge>}
          {transaction.is_draft && (
            <StatusBadge tone="warning">Draft</StatusBadge>
          )}
          {asset && <StatusBadge>{asset}</StatusBadge>}
        </span>
      </button>
    </article>
  );
}

function BulkBar({
  count,
  action,
  setAction,
  value,
  setValue,
  categories,
  tags,
  run,
  clear,
}) {
  return (
    <Surface className="bulk-bar">
      <strong>{count} selected</strong>
      <select
        aria-label="Bulk action"
        value={action}
        onChange={(event) => setAction(event.target.value)}
      >
        <option value="set_pinned">Pin status</option>
        <option value="add_tags">Add tag</option>
        <option value="remove_tags">Remove tag</option>
        <option value="set_category">Set category</option>
        <option value="apply_drafts">Apply drafts</option>
      </select>
      {action === "set_pinned" && (
        <select
          value={value}
          onChange={(event) => setValue(event.target.value)}
        >
          <option value="true">Pin</option>
          <option value="false">Unpin</option>
        </select>
      )}
      {action === "set_category" && (
        <select
          value={value}
          onChange={(event) => setValue(event.target.value)}
        >
          <option value="">Choose category</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.category}
            </option>
          ))}
        </select>
      )}
      {(action === "add_tags" || action === "remove_tags") && (
        <select
          value={value}
          onChange={(event) => setValue(event.target.value)}
        >
          <option value="">Choose tag</option>
          {tags.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        disabled={action !== "apply_drafts" && value === ""}
        onClick={run}
      >
        Apply
      </button>
      <button type="button" onClick={clear}>
        Clear
      </button>
    </Surface>
  );
}

function Pagination({ page, pages, setPage }) {
  if (pages <= 1) return null;
  return (
    <nav className="search-pagination" aria-label="Search pages">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => setPage(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

function Analytics({
  breakdowns,
  insights,
  currency,
  onDismiss,
  onOpen,
  updateParams,
}) {
  if (!breakdowns && !insights) return null;
  return (
    <section className="search-analytics">
      <h2>Analysis and review</h2>
      <div className="analytics-grid">
        <Surface className="chart-card">
          <h3>Cash flow by month</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={breakdowns?.monthly || []}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line dataKey="income" stroke="var(--chart-series-1)" />
              <Line dataKey="expenses" stroke="var(--chart-series-4)" />
            </LineChart>
          </ResponsiveContainer>
        </Surface>
        <Surface className="chart-card">
          <h3>Expense categories</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={(breakdowns?.categories || []).slice(0, 8)}
              layout="vertical"
            >
              <XAxis type="number" />
              <YAxis type="category" dataKey="label" width={90} />
              <Tooltip formatter={(value) => `${value} ${currency}`} />
              <Bar
                dataKey="value"
                fill="var(--chart-series-2)"
                onClick={(entry) => {
                  const facet = entry?.payload;
                  if (facet?.id) updateParams({ category_ids: facet.id });
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </Surface>
        <Surface className="chart-card">
          <h3>Activity by account</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={(breakdowns?.accounts || []).slice(0, 8)}
              layout="vertical"
            >
              <XAxis type="number" />
              <YAxis type="category" dataKey="label" width={90} />
              <Tooltip formatter={(value) => `${value} ${currency}`} />
              <Bar
                dataKey="value"
                fill="var(--chart-series-3)"
                onClick={(entry) => {
                  const facet = entry?.payload;
                  if (facet?.id) updateParams({ account_ids: facet.id });
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </Surface>
      </div>
      <div className="insight-grid">
        <InsightList
          title="Possible duplicates"
          items={insights?.duplicates || []}
          onDismiss={onDismiss}
          onOpen={onOpen}
        />
        <InsightList
          title="Recurring patterns"
          items={insights?.recurring || []}
          onDismiss={onDismiss}
          onOpen={onOpen}
        />
        <Surface>
          <h3>Needs attention</h3>
          <p>
            {insights?.uncategorized_transaction_ids?.length || 0} uncategorized
            transactions
          </p>
          <p>
            {insights?.unusually_large_expense_ids?.length || 0} unusually large
            expenses
          </p>
        </Surface>
      </div>
    </section>
  );
}

function InsightList({ title, items, onDismiss, onOpen }) {
  return (
    <Surface>
      <h3>{title}</h3>
      {items.length ? (
        items.map((item) => (
          <div className="insight-item" key={item.fingerprint}>
            <p>{item.reason}</p>
            <button type="button" onClick={() => onOpen(item.transactions[0])}>
              Inspect
            </button>
            <button type="button" onClick={() => onDismiss(item)}>
              Dismiss
            </button>
          </div>
        ))
      ) : (
        <p>Nothing to review.</p>
      )}
    </Surface>
  );
}

function groupResults(rows, groupBy) {
  if (groupBy === "none") return { Results: rows };
  return rows.reduce((groups, row) => {
    let key = "Other";
    if (groupBy === "type")
      key = GROUP_LABELS[row.transaction_type] || row.transaction_type;
    if (groupBy === "account")
      key = row.from_account_name || row.to_account_name || "No account";
    if (groupBy === "category") key = row.category_name || "Uncategorized";
    if (groupBy === "month") key = String(row.date).slice(0, 7);
    groups[key] = [...(groups[key] || []), row];
    return groups;
  }, {});
}

function buildActiveChips(params) {
  const labels = {
    q: "Search",
    types: "Type",
    account_ids: "Account",
    cash_balance_ids: "Cash balance",
    category_ids: "Category",
    tag_ids: "Tag",
    currencies: "Currency",
    from_date: "From",
    to_date: "To",
    min_amount: "Minimum",
    max_amount: "Maximum",
    draft_status: "Status",
    pinned: "Pinned",
  };
  return Object.entries(labels)
    .filter(([key]) => params.get(key))
    .map(([key, label]) => ({ key, label: `${label}: ${params.get(key)}` }));
}

export { TransactionRow, buildActiveChips, groupResults };
export default SearchResults;
