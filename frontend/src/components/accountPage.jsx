import { useEffect, useMemo, useState } from "react";
import { useGlobalContext } from "../context/GlobalContext";
import "./accountPage.scss";
import { useParams } from "react-router-dom";
import { Navigate } from "react-router-dom";
import NotFound from "./notfound";
import { helper } from "./helper";
import accountService from "../services/transactionService/accountService";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TABS = ["Overview", "Holdings", "Cash", "Transactions", "Analytics"];
const COLORS = ["#3b7f8f", "#6c8f3b", "#9b6a3b", "#7b6fb0", "#a85f6a"];
const chartAxisTick = { fill: "var(--chart-axis)", fontSize: 12 };
const TX_LABELS = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
  buy: "Buy",
  sell: "Sell",
};

const AccountPage = () => {
  const { id } = useParams();
  const global = useGlobalContext();
  const [transactions, setTransactions] = useState([]);
  const [accountStats, setAccountStats] = useState(null);
  const [overview, setOverview] = useState(null);
  const [activeTab, setActiveTab] = useState("Overview");
  const [loading, setLoading] = useState(true);

  const account = useMemo(() => {
    if (!Array.isArray(global.accounts)) {
      return null;
    }
    return (
      global.accounts.find((item) => Number(item.id) === Number(id)) ||
      "Not Found"
    );
  }, [global.accounts, id]);

  useEffect(() => {
    let active = true;

    async function getAccountData() {
      if (!account || account === "Not Found") {
        return;
      }
      setLoading(true);
      const [transactionsData, statsData, overviewData] = await Promise.all([
        accountService.getAccountTransactions(id),
        accountService.getAccountStats(id),
        accountService.getAccountOverview(id, global.globalCurrency),
      ]);
      if (active) {
        setTransactions(
          Array.isArray(transactionsData) ? transactionsData : []
        );
        setAccountStats(statsData || null);
        setOverview(overviewData || null);
        setLoading(false);
      }
    }

    getAccountData();

    return () => {
      active = false;
    };
  }, [account, global.globalCurrency, id]);

  if (!global.authToken) {
    return <Navigate push to="/login" />;
  }

  if (!Array.isArray(global.accounts) || loading) {
    return <div className="account-page-loading">Loading account...</div>;
  }

  if (account === "Not Found" || global.user?.data?.id !== account?.user) {
    return <NotFound />;
  }

  return (
    <div className="account-page-wrapper">
      <AccountHeader
        account={account}
        overview={overview}
        stats={accountStats}
        currency={global.globalCurrency}
      />
      <div className="account-layout">
        <AccountSidebar
          account={account}
          overview={overview}
          stats={accountStats}
          currency={global.globalCurrency}
        />
        <main className="account-workspace">
          <div className="account-tabs">
            {TABS.map((tab) => (
              <button
                key={tab}
                className={activeTab === tab ? "active" : ""}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>
          {activeTab === "Overview" && (
            <OverviewTab
              overview={overview}
              stats={accountStats}
              currency={global.globalCurrency}
            />
          )}
          {activeTab === "Holdings" && (
            <HoldingsTab overview={overview} currency={global.globalCurrency} />
          )}
          {activeTab === "Cash" && (
            <CashTab overview={overview} currency={global.globalCurrency} />
          )}
          {activeTab === "Transactions" && (
            <TransactionsTab
              transactions={transactions}
              account={account}
              currency={global.globalCurrency}
            />
          )}
          {activeTab === "Analytics" && (
            <AnalyticsTab
              overview={overview}
              stats={accountStats}
              currency={global.globalCurrency}
            />
          )}
        </main>
      </div>
    </div>
  );
};

const AccountHeader = ({ account, overview, stats, currency }) => {
  const global = useGlobalContext();
  const totals = overview?.totals || {};
  return (
    <header className="account-hero">
      <div>
        <div className="account-kind">
          {account.type_display || account.name}
        </div>
        <h1>
          {account.name}
          <span className={account.deleted ? "status inactive" : "status"}>
            {account.deleted ? "Inactive" : "Active"}
          </span>
        </h1>
      </div>
      <Metric
        label="Total"
        value={totals.total}
        currency={currency}
        mask={global.privacyMode}
      />
      <Metric
        label="Cash"
        value={totals.cash_total}
        currency={currency}
        mask={global.privacyMode}
      />
      <Metric
        label="Holdings"
        value={totals.holdings_total}
        currency={currency}
        mask={global.privacyMode}
      />
      <SignedMetric
        label="YTD Net"
        value={stats?.net_year_to_date}
        currency={account.currency}
        mask={global.privacyMode}
      />
    </header>
  );
};

const AccountSidebar = ({ account, overview, stats, currency }) => {
  const global = useGlobalContext();
  return (
    <aside className="account-sidebar">
      <section>
        <h2>Account</h2>
        <InfoRow label="Type" value={account.type_display} />
        <InfoRow
          label="Created"
          value={helper.formatDatetime(account.created_on)}
        />
        <InfoRow
          label="Updated"
          value={helper.formatDatetime(account.updated_on)}
        />
        <InfoRow
          label="Status"
          value={account.deleted ? "Inactive" : "Active"}
        />
      </section>
      <section>
        <h2>Cash</h2>
        {(overview?.cash_balances || []).map((balance) => (
          <InfoRow
            key={balance.id}
            label={balance.currency.code}
            value={`${helper.showOrMask(
              global.privacyMode,
              helper.formatNumber(balance.balance)
            )} ${
              balance.currency.symbol ||
              helper.getCurrency(balance.currency.code)
            }`}
          />
        ))}
      </section>
      <section>
        <h2>Performance</h2>
        <SignedInfoRow
          label="MTD"
          value={stats?.net_month_to_date}
          currency={account.currency}
          mask={global.privacyMode}
        />
        <SignedInfoRow
          label="YTD"
          value={stats?.net_year_to_date}
          currency={account.currency}
          mask={global.privacyMode}
        />
        <SignedInfoRow
          label="Last month"
          value={stats?.last_month_p_and_l}
          currency={account.currency}
          mask={global.privacyMode}
        />
      </section>
      <section>
        <h2>Base</h2>
        <InfoRow label="View currency" value={currency} />
      </section>
    </aside>
  );
};

const OverviewTab = ({ overview, stats, currency }) => {
  const global = useGlobalContext();
  const totals = overview?.totals || {};
  return (
    <div className="tab-panel">
      <div className="metric-grid">
        <Metric
          label="Total value"
          value={totals.total}
          currency={currency}
          mask={global.privacyMode}
        />
        <Metric
          label="Cash value"
          value={totals.cash_total}
          currency={currency}
          mask={global.privacyMode}
        />
        <Metric
          label="Invested value"
          value={totals.holdings_total}
          currency={currency}
          mask={global.privacyMode}
        />
        <SignedMetric
          label="MTD net"
          value={stats?.net_month_to_date}
          currency={currency}
          mask={global.privacyMode}
        />
      </div>
      <div className="chart-grid">
        <ChartCard title="Cash vs Holdings">
          <DonutChart data={overview?.allocations?.cash_vs_holdings || []} />
        </ChartCard>
        <ChartCard title="Asset Classes">
          <BarListChart
            data={overview?.allocations?.holdings_by_asset_class || []}
            dataKey="amount"
            nameKey="label"
          />
        </ChartCard>
        <ChartCard title="Monthly Activity">
          <MonthlyActivityChart
            data={
              overview?.activity?.transactions_by_month ||
              stats?.transactions_by_month ||
              []
            }
          />
        </ChartCard>
      </div>
    </div>
  );
};

const HoldingsTab = ({ overview, currency }) => {
  const global = useGlobalContext();
  const [sortKey, setSortKey] = useState("converted_market_value");
  const holdings = useMemo(() => {
    return [...(overview?.holdings || [])].sort((a, b) => {
      const aValue = holdingSortValue(a, sortKey);
      const bValue = holdingSortValue(b, sortKey);
      if (typeof aValue === "string" || typeof bValue === "string") {
        return String(aValue || "").localeCompare(String(bValue || ""));
      }
      return Number(bValue || 0) - Number(aValue || 0);
    });
  }, [overview, sortKey]);

  return (
    <div className="tab-panel">
      <div className="split-grid">
        <ChartCard title="Security Allocation">
          <DonutChart
            data={overview?.allocations?.holdings_by_security || []}
          />
        </ChartCard>
        <ChartCard title="Gain/Loss">
          <BarListChart
            data={holdings}
            dataKey="converted_unrealized_gain"
            nameKey="security.ticker"
            signed
          />
        </ChartCard>
      </div>
      <DataTable>
        <thead>
          <tr>
            <SortableTh
              label="Ticker"
              sortKey="ticker"
              setSortKey={setSortKey}
            />
            <th>Name</th>
            <th>Asset</th>
            <SortableTh
              label="Qty"
              sortKey="quantity"
              setSortKey={setSortKey}
            />
            <SortableTh
              label="Avg Cost"
              sortKey="average_cost"
              setSortKey={setSortKey}
            />
            <SortableTh
              label="Price"
              sortKey="latest_price"
              setSortKey={setSortKey}
            />
            <SortableTh
              label="Value"
              sortKey="converted_market_value"
              setSortKey={setSortKey}
            />
            <SortableTh
              label="Gain"
              sortKey="converted_unrealized_gain"
              setSortKey={setSortKey}
            />
            <th>Alloc</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => (
            <tr key={holding.id}>
              <td>{holding.security.ticker}</td>
              <td>{holding.security.name}</td>
              <td>{holding.security.asset_class_label}</td>
              <td>{helper.formatNumber(holding.quantity, 4)}</td>
              <td>
                {money(
                  holding.average_cost,
                  holding.security.currency.code,
                  global.privacyMode
                )}
              </td>
              <td>
                {holding.latest_price ? (
                  money(
                    holding.latest_price.price,
                    holding.security.currency.code,
                    global.privacyMode
                  )
                ) : (
                  <span className="muted">Missing</span>
                )}
                {holding.price_missing && (
                  <span className="badge">fallback</span>
                )}
              </td>
              <td>
                {money(
                  holding.converted_market_value,
                  currency,
                  global.privacyMode
                )}
              </td>
              <td className={signedClass(holding.converted_unrealized_gain)}>
                {money(
                  holding.converted_unrealized_gain,
                  currency,
                  global.privacyMode,
                  true
                )}
              </td>
              <td>{helper.formatNumber(holding.allocation_percent)}%</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
};

const CashTab = ({ overview, currency }) => {
  const global = useGlobalContext();
  const [showZero, setShowZero] = useState(false);
  const balances = (overview?.cash_balances || []).filter(
    (balance) => showZero || Number(balance.balance || 0) !== 0
  );
  return (
    <div className="tab-panel">
      <div className="table-toolbar">
        <button type="button" onClick={() => setShowZero((value) => !value)}>
          {showZero ? "Hide zero balances" : "Show zero balances"}
        </button>
      </div>
      <div className="cash-grid">
        {balances.map((balance) => (
          <div className="cash-card" key={balance.id}>
            <span>{balance.currency.code}</span>
            <strong>
              {money(
                balance.balance,
                balance.currency.code,
                global.privacyMode
              )}
            </strong>
            <small>
              {money(balance.converted_value, currency, global.privacyMode)} /{" "}
              {helper.formatNumber(balance.allocation_percent)}%
            </small>
          </div>
        ))}
      </div>
      <DataTable>
        <thead>
          <tr>
            <th>Currency</th>
            <th>Native Balance</th>
            <th>Converted</th>
            <th>Allocation</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {balances.map((balance) => (
            <tr key={balance.id}>
              <td>{balance.currency.code}</td>
              <td>
                {money(
                  balance.balance,
                  balance.currency.code,
                  global.privacyMode
                )}
              </td>
              <td>
                {money(balance.converted_value, currency, global.privacyMode)}
              </td>
              <td>{helper.formatNumber(balance.allocation_percent)}%</td>
              <td>{helper.formatDatetime(balance.updated_on)}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
};

const TransactionsTab = ({ transactions, account, currency }) => {
  const global = useGlobalContext();
  const current = new Date();
  const [period, setPeriod] = useState({
    year: String(current.getFullYear()),
    month: String(current.getMonth() + 1).padStart(2, "0"),
    mode: "month",
  });
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");

  const years = useMemo(() => {
    const result = new Set(
      transactions.map((item) => String(new Date(item.date).getFullYear()))
    );
    result.add(period.year);
    return Array.from(result).sort((a, b) => b - a);
  }, [transactions, period.year]);

  const shown = useMemo(() => {
    return transactions.filter((item) => {
      const date = new Date(item.date);
      const yearMatches = String(date.getFullYear()) === period.year;
      const monthMatches =
        String(date.getMonth() + 1).padStart(2, "0") === period.month;
      const periodMatches =
        period.mode === "year" ? yearMatches : yearMatches && monthMatches;
      const typeMatches = type === "all" || item.transaction_type === type;
      const q = query.trim().toLowerCase();
      const queryMatches =
        !q ||
        String(item.description || "")
          .toLowerCase()
          .includes(q) ||
        String(item.ticker || "")
          .toLowerCase()
          .includes(q) ||
        getCategoryName(item, global).toLowerCase().includes(q);
      return periodMatches && typeMatches && queryMatches;
    });
  }, [transactions, period, type, query, global]);

  return (
    <div className="tab-panel">
      <div className="filters">
        <select
          value={period.year}
          onChange={(e) =>
            setPeriod((prev) => ({ ...prev, year: e.target.value }))
          }
        >
          {years.map((year) => (
            <option key={year}>{year}</option>
          ))}
        </select>
        <select
          value={period.month}
          onChange={(e) =>
            setPeriod((prev) => ({
              ...prev,
              month: e.target.value,
              mode: "month",
            }))
          }
        >
          {monthOptions().map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={period.mode === "year" ? "active" : ""}
          onClick={() => setPeriod((prev) => ({ ...prev, mode: "year" }))}
        >
          All year
        </button>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All types</option>
          {Object.entries(TX_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter category, security, text"
        />
      </div>
      <DataTable>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Description</th>
            <th>Security</th>
            <th>Amount</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((transaction) => (
            <tr key={`${transaction.transaction_type}-${transaction.id}`}>
              <td>{transaction.date}</td>
              <td>
                {TX_LABELS[transaction.transaction_type] ||
                  transaction.transaction_type}
              </td>
              <td>{transaction.description || "-"}</td>
              <td>{transaction.ticker || "-"}</td>
              <td
                className={signedClass(
                  transactionSignedAmount(transaction, account)
                )}
              >
                {money(
                  transactionSignedAmount(transaction, account),
                  transaction.currency || account.currency || currency,
                  global.privacyMode,
                  true
                )}
              </td>
              <td>{getCategoryName(transaction, global)}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
};

const AnalyticsTab = ({ overview, stats, currency }) => {
  return (
    <div className="tab-panel">
      <div className="chart-grid">
        <ChartCard title="Income Running Total">
          <LineSeries
            data={stats?.running_total_incomes_current_year || []}
            dataKey="running_total"
          />
        </ChartCard>
        <ChartCard title="Expense Running Total">
          <LineSeries
            data={stats?.running_total_expenses_current_year || []}
            dataKey="running_total"
          />
        </ChartCard>
        <ChartCard title="Expenses by Category">
          <BarListChart
            data={stats?.expenses_by_category || []}
            dataKey="total_amount"
            nameKey="category__category"
          />
        </ChartCard>
        <ChartCard title="Incomes by Category">
          <BarListChart
            data={stats?.incomes_by_category || []}
            dataKey="total_amount"
            nameKey="category__category"
          />
        </ChartCard>
        <ChartCard title={`Unrealized Gain (${currency})`}>
          <BarListChart
            data={overview?.holdings || []}
            dataKey="converted_unrealized_gain"
            nameKey="security.ticker"
            signed
          />
        </ChartCard>
      </div>
    </div>
  );
};

const Metric = ({ label, value = 0, currency, mask }) => (
  <div className="metric">
    <span>{label}</span>
    <strong>{money(value || 0, currency, mask)}</strong>
  </div>
);

const SignedMetric = ({ label, value = 0, currency, mask }) => (
  <div className="metric">
    <span>{label}</span>
    <strong className={signedClass(value)}>
      {money(value || 0, currency, mask, true)}
    </strong>
  </div>
);

const InfoRow = ({ label, value }) => (
  <div className="info-row">
    <span>{label}</span>
    <strong>{value || "-"}</strong>
  </div>
);

const SignedInfoRow = ({ label, value = 0, currency, mask }) => (
  <div className="info-row">
    <span>{label}</span>
    <strong className={signedClass(value)}>
      {money(value || 0, currency, mask, true)}
    </strong>
  </div>
);

const ChartCard = ({ title, children }) => (
  <section className="chart-card">
    <h2>{title}</h2>
    {children}
  </section>
);

const DataTable = ({ children }) => (
  <div className="data-table">
    <table>{children}</table>
  </div>
);

const SortableTh = ({ label, sortKey, setSortKey }) => (
  <th>
    <button type="button" onClick={() => setSortKey(sortKey)}>
      {label}
    </button>
  </th>
);

const DonutChart = ({ data }) => {
  const rows = data.filter((row) => Number(row.amount || 0) !== 0);
  if (!rows.length) {
    return <div className="empty-state">No data</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={rows}
          dataKey="amount"
          nameKey="name"
          innerRadius={58}
          outerRadius={88}
        >
          {rows.map((entry, index) => (
            <Cell
              key={entry.name || index}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--chart-tooltip-bg)",
            borderColor: "var(--border)",
            color: "var(--chart-tooltip-text)",
          }}
        />
        <Legend wrapperStyle={{ color: "var(--chart-axis)" }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

const BarListChart = ({ data, dataKey, nameKey, signed = false }) => {
  const rows = (data || [])
    .map((row) => ({
      ...row,
      label: getNested(row, nameKey),
      value: Number(row[dataKey] || 0),
    }))
    .filter((row) => row.label);
  if (!rows.length) {
    return <div className="empty-state">No data</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows}>
        <XAxis dataKey="label" tick={chartAxisTick} />
        <YAxis tick={chartAxisTick} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--chart-tooltip-bg)",
            borderColor: "var(--border)",
            color: "var(--chart-tooltip-text)",
          }}
        />
        <Bar dataKey="value">
          {rows.map((entry, index) => (
            <Cell
              key={entry.label}
              fill={
                signed
                  ? entry.value >= 0
                    ? "#2f9e44"
                    : "#c92a2a"
                  : COLORS[index % COLORS.length]
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

const MonthlyActivityChart = ({ data }) => {
  const rows = (data || []).map((row) => ({
    month: String(row.month_year || "").slice(0, 7),
    income: row.income_count || 0,
    expense: row.expense_count || 0,
    transfer: row.transfer_count || 0,
    buy: row.buy_count || 0,
    sell: row.sell_count || 0,
  }));
  if (!rows.length) {
    return <div className="empty-state">No data</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows}>
        <XAxis dataKey="month" tick={chartAxisTick} />
        <YAxis allowDecimals={false} tick={chartAxisTick} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--chart-tooltip-bg)",
            borderColor: "var(--border)",
            color: "var(--chart-tooltip-text)",
          }}
        />
        <Legend wrapperStyle={{ color: "var(--chart-axis)" }} />
        <Bar dataKey="income" fill="#2f9e44" />
        <Bar dataKey="expense" fill="#c92a2a" />
        <Bar dataKey="transfer" fill="#3b7f8f" />
        <Bar dataKey="buy" fill="#9b6a3b" />
        <Bar dataKey="sell" fill="#6c8f3b" />
      </BarChart>
    </ResponsiveContainer>
  );
};

const LineSeries = ({ data, dataKey }) => {
  if (!data?.length) {
    return <div className="empty-state">No data</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <XAxis dataKey="date" tick={chartAxisTick} />
        <YAxis tick={chartAxisTick} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--chart-tooltip-bg)",
            borderColor: "var(--border)",
            color: "var(--chart-tooltip-text)",
          }}
        />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke="#3b7f8f"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

function money(value, currency, mask, signed = false) {
  const number = Number(value || 0);
  const prefix = signed && number > 0 ? "+" : "";
  return `${prefix}${helper.showOrMask(mask, helper.formatNumber(number))} ${
    helper.getCurrency(currency) || currency || ""
  }`;
}

function signedClass(value) {
  return Number(value || 0) >= 0 ? "positive" : "negative";
}

function getNested(row, path) {
  return path.split(".").reduce((value, key) => value?.[key], row);
}

function monthOptions() {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(2000, index, 1);
    return {
      value: String(index + 1).padStart(2, "0"),
      label: date.toLocaleString("en-US", { month: "short" }),
    };
  });
}

function transactionSignedAmount(transaction, account) {
  const amount = Number(transaction.amount || 0);
  if (
    transaction.transaction_type === "income" ||
    transaction.transaction_type === "sell"
  ) {
    return amount;
  }
  if (
    transaction.transaction_type === "expense" ||
    transaction.transaction_type === "buy"
  ) {
    return -amount;
  }
  if (transaction.transaction_type === "transfer") {
    return Number(transaction.to_account) === Number(account.id)
      ? amount
      : -amount;
  }
  return amount;
}

function getCategoryName(transaction, global) {
  if (transaction.transaction_type === "transfer") {
    return "Transfer";
  }
  if (
    transaction.transaction_type === "buy" ||
    transaction.transaction_type === "sell"
  ) {
    return "Security trade";
  }
  const categories =
    transaction.transaction_type === "income"
      ? global.incomeCategories
      : global.expenseCategories;
  const category = categories?.find((item) => item.id === transaction.category);
  return category?.category || "Uncategorized";
}

function holdingSortValue(holding, sortKey) {
  if (sortKey === "ticker") {
    return holding.security?.ticker;
  }
  if (sortKey === "latest_price") {
    return holding.latest_price?.price || 0;
  }
  return holding[sortKey];
}

export default AccountPage;
