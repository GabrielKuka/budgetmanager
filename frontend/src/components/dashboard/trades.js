import React, { useState, useEffect } from "react";
import transactionService from "../../services/transactionService/transactionService";
import "./trades.scss";
import NoDataCard from "../core/nodata";
import { helper } from "../helper";
import currencyService from "../../services/currencyService";
import TransactionPopup from "../core/transaction_popup";
import { useGlobalContext } from "../../context/GlobalContext";
import LoadingCard from "../core/LoadingCard";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import InvestmentChart from "./investmentChart";

const Trades = () => {
  const global = useGlobalContext();
  const accounts = global.activeAccounts || [];
  const accountsLoaded =
    Array.isArray(global.accounts) && Array.isArray(global.activeAccounts);

  const [allTrades, setAllTrades] = useState(null);
  const [shownTrades, setShownTrades] = useState([]);
  const [transactionPopup, setTransactionPopup] = useState(false);
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString()
  );
  const [showAll, setShowAll] = useState(false);
  const [showDrafts, setShowDrafts] = useState(true);
  const [stocksExpanded, setStocksExpanded] = useState(true);
  const [tradesExpanded, setTradesExpanded] = useState(false);

  // Fetch all trades on mount
  useEffect(() => {
    (async () => {
      const data = await transactionService.getAllUserTrades(true);
      setAllTrades(data || []);
    })();
  }, []);

  // Filter by year whenever selectedYear or showAll changes
  useEffect(() => {
    if (!allTrades) return;
    let filtered = allTrades;
    if (!showAll) {
      const year = parseInt(selectedYear, 10);
      filtered = filtered.filter(
        (t) => t.date && t.date.startsWith(year.toString())
      );
    }
    if (!showDrafts) {
      filtered = filtered.filter((t) => !t.is_draft);
    }
    setShownTrades(filtered);
  }, [allTrades, selectedYear, showAll, showDrafts]);

  // Refresh handler
  const refreshTrades = async () => {
    const data = await transactionService.getAllUserTrades();
    setAllTrades(data || []);
  };

  function getAccountCurrency(id) {
    const account = global.accounts?.find((a) => Number(a.id) === Number(id));
    if (account) {
      return account.currency;
    }
    return accountsLoaded ? "Not Found" : null;
  }

  function getTransactionCurrency(transaction) {
    return helper.getTransactionCurrency(
      global.accounts,
      transaction,
      getAccountCurrency
    );
  }

  function handleYearChange(e) {
    setSelectedYear(e.target.value);
    setShowAll(false);
  }

  function handleToggleAll() {
    setShowAll((prev) => !prev);
  }

  return (
    <div className="trades-wrapper">
      <Sidebar
        shownTrades={shownTrades}
        dateRange={global.dateRange}
        getTransactionCurrency={getTransactionCurrency}
      />
      <div className="trades-wrapper__content">
        {/* Investment Value Chart — above accordions */}
        <InvestmentChart />

        {/* Stock Holdings Accordion — default visible */}
        <AccordionSection
          title="Stock Holdings"
          expanded={stocksExpanded}
          onToggle={() => setStocksExpanded((p) => !p)}
        >
          <StockHoldings />
        </AccordionSection>

        {/* Trades Accordion — default folded, filters inside */}
        <AccordionSection
          title="Trades"
          expanded={tradesExpanded}
          onToggle={() => setTradesExpanded((p) => !p)}
        >
          <div className="trades-filter-bar">
            <select
              className="trades-filter-bar__year"
              value={selectedYear}
              onChange={handleYearChange}
              aria-label="Select year"
              disabled={showAll}
            >
              {(() => {
                const years = [];
                const current = new Date().getFullYear();
                for (let y = current - 10; y <= current; y++) {
                  years.push(y);
                }
                return years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ));
              })()}
            </select>
            <button
              className={`trades-filter-bar__toggle${showAll ? " active" : ""}`}
              onClick={handleToggleAll}
            >
              {showAll ? "Showing all trades" : "Load all trades"}
            </button>
            <button
              className={`trades-filter-bar__draft-toggle${
                showDrafts ? " active" : ""
              }`}
              onClick={() => setShowDrafts((prev) => !prev)}
            >
              {showDrafts ? "Hide Drafts" : "Show Drafts"}
            </button>
          </div>
          {!allTrades || !accountsLoaded ? (
            <LoadingCard header="Loading Trades..." />
          ) : shownTrades && !shownTrades?.length ? (
            <NoDataCard
              header={"No trades found."}
              label={"Add a buy or sell"}
            />
          ) : (
            <TradesList
              trades={shownTrades}
              accounts={accounts}
              getTransactionCurrency={getTransactionCurrency}
              refreshTrades={refreshTrades}
              setTransactionPopup={setTransactionPopup}
              showDrafts={showDrafts}
              setShowDrafts={setShowDrafts}
            />
          )}
        </AccordionSection>

        {transactionPopup && (
          <TransactionPopup
            transaction={transactionPopup}
            showPopup={setTransactionPopup}
            refreshTransactions={refreshTrades}
            getAccountCurrency={getAccountCurrency}
          />
        )}
      </div>
    </div>
  );
};

const COLORS = [
  "#e67e22",
  "#27ae60",
  "#3498db",
  "#9b59b6",
  "#e74c3c",
  "#1abc9c",
  "#f39c12",
  "#2ecc71",
  "#2980b9",
  "#8e44ad",
];

const Sidebar = (props) => {
  const global = useGlobalContext();
  const [totalTradeVolume, setTotalTradeVolume] = useState(0);
  const [totalBuys, setTotalBuys] = useState(0);
  const [totalSells, setTotalSells] = useState(0);
  const [sidebarLoading, setSidebarLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const shownTrades = props.shownTrades || [];

    async function computeTotals() {
      const buys = shownTrades.filter((t) => t.transaction_type === "buy");
      const sells = shownTrades.filter((t) => t.transaction_type === "sell");

      const buyPromises = buys.map(async (t) =>
        currencyService.convert(
          props.getTransactionCurrency(t),
          global.globalCurrency,
          t.amount
        )
      );
      const sellPromises = sells.map(async (t) =>
        currencyService.convert(
          props.getTransactionCurrency(t),
          global.globalCurrency,
          t.amount
        )
      );

      const [buyResults, sellResults] = await Promise.all([
        Promise.all(buyPromises),
        Promise.all(sellPromises),
      ]);

      const buyTotal = buyResults.reduce(
        (acc, curr) => acc + parseFloat(curr),
        0
      );
      const sellTotal = sellResults.reduce(
        (acc, curr) => acc + parseFloat(curr),
        0
      );

      if (!active) return;
      setTotalBuys(parseFloat(buyTotal).toFixed(2));
      setTotalSells(parseFloat(sellTotal).toFixed(2));
      setTotalTradeVolume(parseFloat(buyTotal + sellTotal).toFixed(2));
    }

    computeTotals().finally(() => setSidebarLoading(false));

    return () => {
      active = false;
    };
  }, [props.shownTrades, global.globalCurrency, props.getTransactionCurrency]);

  // Holdings summary across all investment accounts
  const [holdingsSummary, setHoldingsSummary] = useState(null);
  const [holdingsLoading, setHoldingsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function compute() {
      setHoldingsLoading(true);
      if (!global.accounts) {
        setHoldingsSummary(null);
        setHoldingsLoading(false);
        return;
      }

      const targetCur = global.globalCurrency;
      const investmentAccs = global.accounts.filter(
        (a) => a.type === 1 && !a.deleted
      );

      // Collect raw holdings with native currency info
      const rawHoldings = [];
      for (const acc of investmentAccs) {
        for (const h of acc.holdings || []) {
          const secCur = h.security?.currency?.code || "EUR";
          rawHoldings.push({
            ticker: h.security?.ticker || "?",
            name: h.security?.name || h.security?.ticker || "?",
            assetClass: h.security?.asset_class || "other",
            quantity: h.quantity ? parseFloat(h.quantity) : 0,
            costBasis: h.cost_basis ? parseFloat(h.cost_basis) : 0,
            marketValue: h.market_value ? parseFloat(h.market_value) : 0,
            unrealizedGain: h.unrealized_gain
              ? parseFloat(h.unrealized_gain)
              : 0,
            currency: secCur,
          });
        }
      }

      // Convert all to target currency
      const convertPromises = rawHoldings.map(async (h) => {
        const [cb, mv, ug] = await Promise.all([
          currencyService.convert(h.currency, targetCur, h.costBasis),
          currencyService.convert(h.currency, targetCur, h.marketValue),
          currencyService.convert(h.currency, targetCur, h.unrealizedGain),
        ]);
        return {
          ...h,
          costBasis: parseFloat(cb),
          marketValue: parseFloat(mv),
          unrealizedGain: parseFloat(ug),
        };
      });

      const converted = await Promise.all(convertPromises);
      if (!active) return;

      // Aggregate by ticker
      const agg = {};
      for (const h of converted) {
        if (!agg[h.ticker]) {
          agg[h.ticker] = {
            ticker: h.ticker,
            name: h.name,
            assetClass: h.assetClass,
            quantity: 0,
            costBasis: 0,
            marketValue: 0,
            unrealizedGain: 0,
          };
        }
        agg[h.ticker].quantity += h.quantity;
        agg[h.ticker].costBasis += h.costBasis;
        agg[h.ticker].marketValue += h.marketValue;
        agg[h.ticker].unrealizedGain += h.unrealizedGain;
      }

      const all = Object.values(agg);
      let totCB = 0,
        totMV = 0,
        totUG = 0;
      const acMap = {};

      for (const h of all) {
        totCB += h.costBasis;
        totMV += h.marketValue;
        totUG += h.unrealizedGain;
        acMap[h.assetClass] = (acMap[h.assetClass] || 0) + h.marketValue;
      }

      all.sort((a, b) => b.marketValue - a.marketValue);

      setHoldingsSummary({
        totalCostBasis: helper.formatNumber(totCB),
        totalMarketValue: helper.formatNumber(totMV),
        totalUnrealizedPnl: helper.formatNumber(totUG),
        unrealizedColor: totUG >= 0 ? "seagreen" : "red",
        top5: all
          .slice(0, 5)
          .map((h) => ({ ticker: h.ticker, marketValue: h.marketValue })),
        assetClassPie: Object.entries(acMap)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => ({
            name: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            value: v,
          })),
        hasData: all.length > 0,
      });
      setHoldingsLoading(false);
    }

    compute();
    return () => {
      active = false;
    };
  }, [global.accounts, global.globalCurrency]);

  return (
    <div className="trades-wrapper__sidebar">
      {sidebarLoading ? (
        <div className="summary">
          <img
            src={`${process.env.PUBLIC_URL}/loading_icon.gif`}
            alt="loading"
            width={40}
            height={40}
          />
        </div>
      ) : (
        <>
          <div className="summary">
            <div className="summary-card__title">Summary</div>
            <div>
              <b>
                {helper.showOrMask(
                  global.privacyMode,
                  helper.formatNumber(totalTradeVolume)
                )}
                {helper.getCurrency(global.globalCurrency)}
              </b>{" "}
              total volume
            </div>
            <div style={{ color: "seagreen" }}>
              <b>
                {helper.showOrMask(
                  global.privacyMode,
                  helper.formatNumber(totalBuys)
                )}
                {helper.getCurrency(global.globalCurrency)}
              </b>{" "}
              bought
            </div>
            <div style={{ color: "red" }}>
              <b>
                {helper.showOrMask(
                  global.privacyMode,
                  helper.formatNumber(totalSells)
                )}
                {helper.getCurrency(global.globalCurrency)}
              </b>{" "}
              sold
            </div>
          </div>

          {holdingsSummary?.hasData && (
            <>
              <div className="summary-card">
                <div className="summary-card__title">Holdings</div>
                <div className="summary-card__row">
                  <span>Cost Basis</span>
                  <span>
                    <b>
                      {helper.showOrMask(
                        global.privacyMode,
                        holdingsSummary.totalCostBasis
                      )}
                      {helper.getCurrency(global.globalCurrency)}
                    </b>
                  </span>
                </div>
                <div className="summary-card__row">
                  <span>Market Value</span>
                  <span>
                    <b>
                      {helper.showOrMask(
                        global.privacyMode,
                        holdingsSummary.totalMarketValue
                      )}
                      {helper.getCurrency(global.globalCurrency)}
                    </b>
                  </span>
                </div>
                <div className="summary-card__row">
                  <span>Unrealized P&amp;L</span>
                  <span
                    style={{
                      color: holdingsSummary.unrealizedColor,
                      fontWeight: "bold",
                    }}
                  >
                    {helper.showOrMask(
                      global.privacyMode,
                      holdingsSummary.totalUnrealizedPnl
                    )}
                    {helper.getCurrency(global.globalCurrency)}
                  </span>
                </div>
              </div>

              {/* Top 5 positions */}
              <div className="summary-card">
                <div className="summary-card__title">Top Positions</div>
                {holdingsSummary.top5.map((pos, i) => (
                  <div key={pos.ticker} className="summary-card__row">
                    <span>
                      {i + 1}. {pos.ticker}
                    </span>
                    <span>
                      <b>
                        {helper.showOrMask(
                          global.privacyMode,
                          helper.formatNumber(pos.marketValue)
                        )}
                        {helper.getCurrency(global.globalCurrency)}
                      </b>
                    </span>
                  </div>
                ))}
              </div>

              {/* Asset class pie chart */}
              {holdingsSummary.assetClassPie.length > 0 && (
                <div className="summary-card">
                  <div className="summary-card__title">By Asset Class</div>
                  <PieChart width={280} height={200}>
                    <Pie
                      data={holdingsSummary.assetClassPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {holdingsSummary.assetClassPie.map((_, i) => (
                        <Cell
                          key={`ac-${i}`}
                          fill={COLORS[i % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val) =>
                        helper.formatNumber(val) +
                        " " +
                        helper.getCurrency(global.globalCurrency)
                      }
                    />
                  </PieChart>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

const TradeItem = ({ trade, currency, refreshTrades, setTransactionPopup }) => {
  const global = useGlobalContext();
  const transactionType = trade.transaction_type;

  function handleShowMore() {
    setTransactionPopup(trade);
  }

  function handleDelete() {
    const payload = { id: trade.id, type: transactionType === "buy" ? 3 : 4 };
    transactionService.deleteTrade(payload).then(() => {
      refreshTrades();
    });
  }

  return (
    <div
      className={`trade-item${trade.pinned ? " pinned" : ""}`}
      onClick={handleShowMore}
    >
      <label id="date" data-label="Date">
        <span className="trade-item__value">{trade.date}</span>
      </label>
      <label id="ticker" data-label="Ticker">
        <span className="trade-item__value trade-item__ticker">
          {trade.security_ticker || "—"}
        </span>
      </label>
      <label id="qty" data-label="Qty">
        <span className="trade-item__value">
          {helper.formatNumber(trade.quantity, 4)}
        </span>
      </label>
      <label id="ppu" data-label="Price/Unit">
        <span className="trade-item__value">
          {helper.formatNumber(trade.price_per_unit, 4)} {currency}
        </span>
      </label>
      <label
        id="amount"
        data-label="Amount"
        style={{ color: helper.amountLabelColor(transactionType) }}
      >
        <span className="trade-item__value">
          {helper.showOrMask(
            global.privacyMode,
            helper.formatNumber(trade.amount)
          )}{" "}
          {currency}
        </span>
      </label>
      <label id="type" data-label="Type">
        <span
          className="trade-item__value"
          style={{
            color: transactionType === "buy" ? "seagreen" : "red",
            fontWeight: "bold",
          }}
        >
          {transactionType === "buy" ? "BUY" : "SELL"}
        </span>
      </label>
    </div>
  );
};

// ---- Accordion wrapper ----
const AccordionSection = ({ title, expanded, onToggle, children }) => (
  <div className="trades-wrapper__accordion">
    <div className="trades-wrapper__accordion-header" onClick={onToggle}>
      <span className="trades-wrapper__accordion-header__title">{title}</span>
      <span
        className={`trades-wrapper__accordion-header__chevron${
          expanded ? " expanded" : ""
        }`}
      >
        ▼
      </span>
    </div>
    <div
      className={`trades-wrapper__accordion-content${
        expanded ? "" : " collapsed"
      }`}
    >
      {children}
    </div>
  </div>
);

// ---- Provider icon matching ----
function getProviderIcon(name) {
  const lower = name.toLowerCase();
  if (lower.includes("interactive brokers") || lower.includes("ibkr"))
    return "ibkr_icon.png";
  if (lower.includes("trading212") || lower.includes("t212"))
    return "t212_icon.png";
  if (lower.includes("wise")) return "wise_icon.png";
  if (lower.includes("revolut")) return "revolut_icon.png";
  return null;
}

// ---- Stock Holdings ----
const StockHoldings = () => {
  const global = useGlobalContext();
  const [stocks, setStocks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stockSearch, setStockSearch] = useState("");
  const targetCur = global.globalCurrency;

  useEffect(() => {
    let active = true;
    async function compute() {
      setLoading(true);
      if (!global.accounts) {
        setStocks(null);
        setLoading(false);
        return;
      }

      const investmentAccs = global.accounts.filter(
        (a) => a.type === 1 && !a.deleted
      );

      // Collect raw holdings with account info
      const rawHoldings = [];
      for (const acc of investmentAccs) {
        const provider = getProviderIcon(acc.name);
        for (const h of acc.holdings || []) {
          const qty = h.quantity ? parseFloat(h.quantity) : 0;
          if (qty <= 0) continue;
          const secCur = h.security?.currency?.code || "EUR";
          const latestPrice = h.latest_price?.price
            ? parseFloat(h.latest_price.price)
            : null;
          const unrealizedGain = h.unrealized_gain
            ? parseFloat(h.unrealized_gain)
            : null;
          rawHoldings.push({
            ticker: h.security?.ticker || "?",
            name: h.security?.name || h.security?.ticker || "?",
            quantity: qty,
            latestPrice,
            unrealizedGain,
            currency: secCur,
            provider,
          });
        }
      }

      // Convert all to target currency
      const convertPromises = rawHoldings.map(async (h) => {
        let price = h.latestPrice;
        let ug = h.unrealizedGain;
        if (h.currency !== targetCur) {
          if (price !== null) {
            price = parseFloat(
              await currencyService.convert(h.currency, targetCur, price)
            );
          }
          if (ug !== null) {
            ug = parseFloat(
              await currencyService.convert(h.currency, targetCur, ug)
            );
          }
        }
        return { ...h, latestPrice: price, unrealizedGain: ug };
      });

      const converted = await Promise.all(convertPromises);
      if (!active) return;

      // Aggregate by ticker, collecting unique providers
      const agg = {};
      for (const h of converted) {
        if (!agg[h.ticker]) {
          agg[h.ticker] = {
            ticker: h.ticker,
            name: h.name,
            quantity: 0,
            latestPrice: null,
            unrealizedGain: 0,
            providers: [],
          };
        }
        agg[h.ticker].quantity += h.quantity;
        // Use latest non-null price
        if (h.latestPrice !== null) {
          agg[h.ticker].latestPrice = h.latestPrice;
        }
        agg[h.ticker].unrealizedGain += h.unrealizedGain || 0;
        if (h.provider && !agg[h.ticker].providers.includes(h.provider)) {
          agg[h.ticker].providers.push(h.provider);
        }
      }

      setStocks(Object.values(agg));
      setLoading(false);
    }

    compute();
    return () => {
      active = false;
    };
  }, [global.accounts, targetCur]);

  if (loading) {
    return (
      <div className="trades-wrapper__stocks-list">
        <div className="stocks" style={{ padding: 20 }}>
          <img
            src={`${process.env.PUBLIC_URL}/loading_icon.gif`}
            alt="loading"
            width={40}
            height={40}
          />
        </div>
      </div>
    );
  }

  if (!stocks || stocks.length === 0) {
    return (
      <div className="trades-wrapper__stocks-list">
        <NoDataCard header="No holdings found." />
      </div>
    );
  }

  const filteredStocks = stockSearch
    ? stocks.filter((s) =>
        s.ticker.toLowerCase().includes(stockSearch.toLowerCase())
      )
    : stocks;

  return (
    <div className="trades-wrapper__stocks-list">
      <div className="header">
        <div className="header__ticker-cell">
          <label>Ticker</label>
          <input
            className="header__ticker-search"
            type="text"
            placeholder="Search…"
            value={stockSearch}
            onChange={(e) => setStockSearch(e.target.value)}
          />
        </div>
        <label>Qty</label>
        <label>Price</label>
        <label>Unrealized P&amp;L</label>
      </div>
      <div className="stocks">
        {filteredStocks.map((s) => (
          <div key={s.ticker} className="trades-wrapper__stock-item">
            <label className="trades-wrapper__stock-item__ticker">
              <span className="trades-wrapper__stock-item__value">
                {s.ticker}
              </span>
              {s.providers.length > 0 && (
                <span className="trades-wrapper__stock-item__icons">
                  {s.providers.map((icon) => (
                    <img
                      key={icon}
                      src={`${process.env.PUBLIC_URL}/${icon}`}
                      alt={icon.replace("_icon.png", "")}
                    />
                  ))}
                </span>
              )}
            </label>
            <label>
              <span className="trades-wrapper__stock-item__value">
                {helper.formatNumber(s.quantity, 4)}
              </span>
            </label>
            <label>
              <span className="trades-wrapper__stock-item__value">
                {s.latestPrice !== null
                  ? `${helper.formatNumber(s.latestPrice)} ${helper.getCurrency(
                      targetCur
                    )}`
                  : "—"}
              </span>
            </label>
            <label>
              <span
                className={`trades-wrapper__stock-item__value ${
                  s.unrealizedGain >= 0 ? "pnl-positive" : "pnl-negative"
                }`}
              >
                {helper.showOrMask(
                  global.privacyMode,
                  `${s.unrealizedGain >= 0 ? "+" : ""}${helper.formatNumber(
                    s.unrealizedGain
                  )} ${helper.getCurrency(targetCur)}`
                )}
              </span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

const TradesList = (props) => {
  return (
    <div className="trades-wrapper__trades-list">
      <div className="header">
        <div>
          <label>Date</label>
        </div>
        <label>Ticker</label>
        <label>Qty</label>
        <label>Price/Unit</label>
        <label>Amount</label>
        <label>Type</label>
      </div>
      <div className="trades">
        {props.trades?.length > 0 &&
          props.trades?.map((trade) => (
            <TradeItem
              key={trade.id}
              trade={trade}
              currency={helper.getCurrency(props.getTransactionCurrency(trade))}
              refreshTrades={props.refreshTrades}
              setTransactionPopup={props.setTransactionPopup}
            />
          ))}
      </div>
    </div>
  );
};

export default Trades;
