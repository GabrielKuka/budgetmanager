import { useEffect, useState } from "react";
import { useGlobalContext } from "../context/GlobalContext";
import "./accountPage.scss";
import { useParams } from "react-router-dom";
import { Navigate } from "react-router-dom";
import NotFound from "./notfound";
import { helper } from "./helper";
import accountService from "../services/transactionService/accountService";

const AccountPage = () => {
  const { id } = useParams();
  const global = useGlobalContext();
  const account = getAccountObject(id);
  const [transactions, setTransactions] = useState(false);
  const [accountStats, setAccountStats] = useState(false);
  const [currentMonthStats, setCurrentMonthStats] = useState({});

  useEffect(() => {
    async function getAccountTransactions() {
      const transactions = await accountService.getAccountTransactions(id);
      setTransactions(transactions);

      const stats = await accountService.getAccountStats(id);
      setAccountStats(stats);
    }

    getAccountTransactions();
  }, []);

  if (!global.authToken) {
    return <Navigate push to="/login" />;
  }

  const invalidAccount = account === "Not Found";
  if (invalidAccount) {
    return <NotFound />;
  }

  const notMyAccount = global.user?.data?.id !== account?.user;
  if (notMyAccount) {
    return <NotFound />;
  }

  function getAccountObject(id) {
    const account = global.accounts?.filter((a) => a.id === parseInt(id));
    if (account?.length === 1) {
      return account[0];
    }

    return "Not Found";
  }

  const accountTypes = ["Bank Account", "Investment Account", "Hard Cash"];

  return (
    <div className={"account-page-wrapper"}>
      <Sidebar
        account={account}
        stats={accountStats}
        accountType={accountTypes[account.type]}
        currentMonthStats={currentMonthStats}
      />
      <MainContainer
        account={account}
        accountType={accountTypes[account.type]}
        transactions={transactions}
        setCurrentMonthStats={setCurrentMonthStats}
      />
    </div>
  );
};

const Sidebar = ({ account, accountType, stats, currentMonthStats }) => {
  const global = useGlobalContext();
  return (
    <div className={"account-page-wrapper__sidebar"}>
      <div id="account_information">
        <div className={"card-label"}>{accountType}</div>
        <div className="grid-container">
          <div className="grid-row">
            <label>Name: </label>
            <span id="account-name">{account.name}</span>
          </div>
          <div className="grid-row">
            <label>Currency: </label>
            <span>{account.currency}</span>
          </div>
          <div className="grid-row">
            <label>Active: </label>
            <span style={{ color: account.deleted ? "red" : "green" }}>
              {account.deleted ? "No" : "Yes ✓"}
            </span>
          </div>
          <div className="grid-row">
            <label>Balance: </label>
            <span>
              {helper.showOrMask(
                global.privacyMode,
                helper.formatNumber(account.amount)
              )}{" "}
              {helper.getCurrency(account.currency)}
            </span>
          </div>
          <div className={"grid-row"}>
            <label>Month to Date:</label>
            {stats != false && (
              <span
                style={{
                  color: stats["net_month_to_date"] >= 0 ? "green" : "red",
                }}
              >
                {stats["net_month_to_date"] >= 0 ? "+" : ""}{" "}
                {helper.showOrMask(
                  global.privacyMode,
                  helper.formatNumber(stats["net_month_to_date"])
                )}{" "}
                {helper.getCurrency(account.currency)}
              </span>
            )}
          </div>
          <div className={"grid-row"}>
            <label>Year to Date:</label>
            {stats != false && (
              <span
                style={{
                  color: stats["net_year_to_date"] >= 0 ? "green" : "red",
                }}
              >
                {stats["net_year_to_date"] >= 0 ? "+" : ""}{" "}
                {helper.showOrMask(
                  global.privacyMode,
                  helper.formatNumber(stats["net_year_to_date"])
                )}{" "}
                {helper.getCurrency(account.currency)}
              </span>
            )}
          </div>
          <div className="grid-row">
            <label>Created On: </label>
            <span className="datetime">
              {helper.formatDatetime(account.created_on)}
            </span>
          </div>
          <div className="grid-row">
            <label>Last activity: </label>
            <span className="datetime">
              {helper.formatDatetime(account.updated_on)}
            </span>
          </div>
        </div>
      </div>

      <div id={"summary-container"}>
        <div className={"card-label"}>Short Summary</div>
        <div className={"grid-container"}>
          <div className={"grid-row"}>
            <label>Expenses:</label>
            <span>
              {helper.showOrMask(
                global.privacyMode,
                helper.formatNumber(
                  currentMonthStats?.transactionsSumByType?.expense || 0
                )
              )}{" "}
              {helper.getCurrency(account.currency)}{" "}
              {currentMonthStats?.transactionsSumByType?.expense !== 0 && (
                <span className={"num_of_transactions"}>
                  ({currentMonthStats?.transactionsCountByType?.expense})
                </span>
              )}
            </span>
          </div>
          <div className={"grid-row"}>
            <label>Incomes:</label>
            <span>
              {helper.showOrMask(
                global.privacyMode,
                helper.formatNumber(
                  currentMonthStats?.transactionsSumByType?.income || 0
                )
              )}{" "}
              {helper.getCurrency(account.currency)}{" "}
              {currentMonthStats?.transactionsSumByType?.income !== 0 && (
                <span className={"num_of_transactions"}>
                  ({currentMonthStats?.transactionsCountByType?.income})
                </span>
              )}
            </span>
          </div>
          <div className={"grid-row"}>
            <label>Transfers:</label>
            <span>
              {helper.showOrMask(
                global.privacyMode,
                helper.formatNumber(
                  currentMonthStats?.transactionsSumByType?.transfer || 0
                )
              )}{" "}
              {helper.getCurrency(account.currency)}{" "}
              {currentMonthStats?.transactionsSumByType?.transfer !== 0 && (
                <span className={"num_of_transactions"}>
                  ({currentMonthStats?.transactionsCountByType?.transfer})
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const MainContainer = ({
  account,
  accountType,
  transactions,
  setCurrentMonthStats,
}) => {
  const [sortedBy, setSortedBy] = useState({});
  const [shownTransactions, setShownTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState({
    year: new Date().getFullYear(),
    month: new Date().toLocaleString("en-US", { month: "short" }),
  });
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const [years, setYears] = useState([]);
  const [groupedTransactions, setGroupedTransactions] = useState({});

  useEffect(() => {
    if (transactions) {
      setIsLoading(false);
      setGroupedTransactions(groupTransactionsByMonthYear(transactions));
    }
  }, [transactions]);

  useEffect(() => {
    if (groupedTransactions) {
      const results = new Set(
        Object.keys(groupedTransactions).map((key) => key.split("-")[0])
      );
      setYears(Array.from(results));
      filterTransactions(groupedTransactions);
    }
  }, [groupedTransactions]);

  useEffect(() => {
    let stats = {};
    if (shownTransactions) {
      const transactionsCountByType = shownTransactions.reduce(
        (counts, transaction) => {
          const type = transaction.transaction_type;
          counts[type] = (counts[type] || 0) + 1;
          return counts;
        },
        { income: 0, expense: 0, transfer: 0 }
      );

      const transactionsSumByType = shownTransactions.reduce(
        (counts, transaction) => {
          const type = transaction.transaction_type;
          counts[type] = (counts[type] || 0) + transaction.amount;
          return counts;
        },
        { income: 0, expense: 0, transfer: 0 }
      );

      stats["transactionsCountByType"] = transactionsCountByType;
      stats["transactionsSumByType"] = transactionsSumByType;
    }
    setCurrentMonthStats(stats);
  }, [shownTransactions]);

  useEffect(() => {
    if (groupedTransactions) {
      filterTransactions(groupedTransactions);
    }
  }, [selectedPeriod]);

  function sortShownTransactions(by = "") {
    if (!by) {
      return;
    }

    let sorted = null;

    if (by == "date") {
      if ("date" in sortedBy) {
        if (sortedBy["date"] == "ascending") {
          sorted = [...shownTransactions].sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          );
          setSortedBy({ date: "descending" });
        } else {
          sorted = [...shownTransactions].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
          );
          setSortedBy({ date: "ascending" });
        }
      } else {
        sorted = [...shownTransactions].sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );
        setSortedBy({ date: "descending" });
      }
      setShownTransactions(sorted);
      return;
    }

    if (`${by}` in sortedBy) {
      if (sortedBy[`${by}`] == "ascending") {
        sorted = [...shownTransactions].sort((a, b) => b[`${by}`] - a[`${by}`]);
        setSortedBy({ [by]: "descending" });
      } else {
        sorted = [...shownTransactions].sort((a, b) => a[`${by}`] - b[`${by}`]);
        setSortedBy({ [by]: "ascending" });
      }
    } else {
      sorted = [...shownTransactions].sort((a, b) => b[`${by}`] - a[`${by}`]);
      setSortedBy({ [by]: "descending" });
    }
    setShownTransactions(sorted);
  }

  function groupTransactionsByMonthYear(transactions) {
    return transactions?.reduce((grouped, transaction) => {
      // Extract the month-year from the transaction date
      const date = new Date(transaction.date);

      const monthYear = `${date.getFullYear()}-${date.toLocaleString("en-US", {
        month: "short",
      })}`;

      // Initialize the group if it doesn't exist
      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }

      // Add the transaction to the appropriate group
      grouped[monthYear].push(transaction);

      return grouped;
    }, {});
  }

  function filterTransactions() {
    if (groupedTransactions) {
      setShownTransactions(
        groupedTransactions[
          `${selectedPeriod["year"]}-${selectedPeriod["month"]}`
        ]
      );
    }
  }

  function selectedMonthButtonStyle(m) {
    if (selectedPeriod["month"] === m) {
      return {
        borderBottom: "2px solid cadetblue",
      };
    }

    return {};
  }

  return (
    <div className={"main-container"}>
      {isLoading && <div id="loading-div">Loading...</div>}
      {!isLoading && (
        <>
          <div className={"time-filter-container"}>
            <select
              className={"years"}
              value={selectedPeriod["year"]}
              onChange={(e) =>
                setSelectedPeriod((prev) => ({
                  ...prev,
                  year: e.target.value,
                }))
              }
            >
              {years && years?.map((y) => <option key={y}>{y}</option>)}
            </select>
            <div className="month-buttons-container">
              {months.map((m) => (
                <button
                  style={selectedMonthButtonStyle(m)}
                  key={m}
                  onClick={() =>
                    setSelectedPeriod((prev) => ({ ...prev, month: m }))
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          {shownTransactions?.length > 0 ? (
            <>
              <div className="transactions-list">
                <div className="header">
                  <div>
                    <label onClick={() => sortShownTransactions("date")}>
                      Date:
                    </label>
                    {sortedBy["date"] == "ascending" && (
                      <img
                        src={`${process.env.PUBLIC_URL}/up_arrow_icon.png`}
                        width="12"
                        height="12"
                      />
                    )}
                    {sortedBy["date"] == "descending" && (
                      <img
                        src={`${process.env.PUBLIC_URL}/down_arrow_icon.png`}
                        width="12"
                        height="12"
                      />
                    )}
                  </div>

                  <label>Description</label>

                  <div>
                    <label onClick={() => sortShownTransactions("amount")}>
                      Amount
                    </label>
                    {sortedBy["amount"] == "ascending" && (
                      <img
                        src={`${process.env.PUBLIC_URL}/up_arrow_icon.png`}
                        width="12"
                        height="12"
                      />
                    )}
                    {sortedBy["amount"] == "descending" && (
                      <img
                        src={`${process.env.PUBLIC_URL}/down_arrow_icon.png`}
                        width="12"
                        height="12"
                      />
                    )}
                  </div>

                  <div>
                    <label>Category:</label>
                  </div>
                </div>
                <div className="content">
                  {shownTransactions?.length > 0 &&
                    shownTransactions?.map((t) => (
                      <TransactionItem
                        transaction={t}
                        key={`${"income_category" in t ? "i" : "e"}_${t.id}`}
                        account={account}
                      />
                    ))}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-account">No transactions found.</div>
          )}
        </>
      )}
    </div>
  );
};

const TransactionItem = ({ account, transaction }) => {
  const global = useGlobalContext();
  const transactionType = transaction.transaction_type;
  const category = getCategory(transaction.category);

  function getCategory(id) {
    const categories =
      transactionType === "income"
        ? global.incomeCategories
        : global.expenseCategories;

    const result = categories.filter((c) => c.id === id);
    if (result.length === 1) {
      return result[0]?.category;
    }

    return "(Transfer)";
  }

  function categoryStyle() {
    if (category === "(Transfer)") {
      return {
        fontStyle: "italic",
        color: "gray",
      };
    }
    return {};
  }

  return (
    <div className={"transaction-item"}>
      {helper.isRecent(transaction?.created_on) && (
        <label className="new-transaction">NEW!</label>
      )}
      <label className="date">{transaction?.date}</label>
      <label>{transaction?.description}</label>
      <label style={{ color: transactionType === "expense" ? "red" : "green" }}>
        {transactionType === "expense" ? "-" : "+"}{" "}
        {helper.showOrMask(
          global.privacyMode,
          helper.formatNumber(transaction?.amount)
        )}{" "}
        {helper.getCurrency(account?.currency)}
      </label>
      <label style={categoryStyle()}>{category}</label>
    </div>
  );
};

export default AccountPage;
