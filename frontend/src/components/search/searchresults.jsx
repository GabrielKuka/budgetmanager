import React, { useState, useEffect } from "react";
import "./searchresults.scss";
import { useGlobalContext } from "../../context/GlobalContext";
import { useLocation, useSearchParams } from "react-router-dom";
import { helper } from "../helper";
import TransactionPopup from "../core/transaction_popup";
import currencyService from "../../services/currencyService";

const SearchResults = (props) => {
  const global = useGlobalContext();

  const [searchParams] = useSearchParams();
  const location = useLocation();

  const accounts = global.accounts;
  const [searchResults, setSearchResults] = useState();

  const [transactionPopup, setTransactionPopup] = useState(false);
  const [searchValue, setSearchValue] = useState(searchParams.get("q"));

  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [transfers, setTransfers] = useState([]);

  const [shownExpenses, setShownExpenses] = useState([]);
  const [shownIncomes, setShownIncomes] = useState([[]]);
  const [shownTransfers, setShownTransfers] = useState([]);

  useEffect(() => {
    const query = searchParams.get("q");
    const results = location.state?.searchResults;
    if (query !== null) {
      setSearchValue(query);

      setSearchResults(results);
    }
  }, [location, searchParams]);

  useEffect(() => {
    setTransactions();
  }, [searchResults]);

  useEffect(() => {
    resetShownTransactions();
  }, [incomes, expenses, transfers]);

  function setTransactions() {
    const searchResults = location.state?.searchResults;
    if (
      searchResults === null ||
      searchResults === false ||
      searchResults === undefined
    ) {
      return;
    }
    const inc = searchResults
      .filter((t) => "income_category" in t)
      .sort((a, b) => (a.date > b.date ? -1 : 1));
    const exp = searchResults
      .filter((t) => "expense_category" in t)
      .sort((a, b) => (a.date > b.date ? -1 : 1));
    const tran = searchResults
      .filter((t) => "from_account" in t)
      .sort((a, b) => (a.date > b.date ? -1 : 1));

    setIncomes(inc);
    setExpenses(exp);
    setTransfers(tran);
  }

  function resetShownTransactions() {
    if (incomes !== null) {
      setShownIncomes(incomes.slice(0, 5));
    }

    if (expenses !== null) {
      setShownExpenses(expenses.slice(0, 5));
    }

    if (transfers !== null) {
      setShownTransfers(transfers.slice(0, 5));
    }
  }

  function updateShownTransactions({
    which = "all",
    showOrHide = "show",
  } = {}) {
    if (incomes !== null && (which === "all" || which === "incomes")) {
      const inc = incomes.slice(
        0,
        showOrHide === "show"
          ? shownIncomes.length + 5
          : Math.max(5, shownIncomes.length - 5)
      );
      setShownIncomes(inc);
    }

    if (expenses !== null && (which === "all" || which === "expenses")) {
      const exp = expenses.slice(
        0,
        showOrHide === "show"
          ? shownExpenses.length + 5
          : Math.max(5, shownExpenses.length - 5)
      );
      setShownExpenses(exp);
    }

    if (transfers !== null && (which === "all" || which === "transfers")) {
      const tran = transfers.slice(
        0,
        showOrHide === "show"
          ? shownTransfers.length + 5
          : Math.max(5, shownTransfers.length - 5)
      );
      setShownTransfers(tran);
    }
  }

  function getAccountCurrency(id) {
    if (accounts !== null && accounts !== undefined) {
      const account = accounts?.filter((a) => a.id === id);
      if (account?.length === 1) {
        return account[0].currency;
      }

      return "Not Found";
    }
  }

  function refreshSearchResults(id) {
    setSearchResults(() => searchResults.filter((t) => t.id != id));
  }

  function showAll(type) {
    switch (type) {
      case "expenses":
        setShownExpenses(expenses);
        break;
      case "incomes":
        setShownIncomes(incomes);
        break;
      case "transfers":
        setShownTransfers(transfers);
        break;
      default:
        return "";
    }
  }

  return (
    <div className={"searchresults-wrapper"}>
      <div className={"searchresults-wrapper__header"}>
        <label>Search results for: '{searchValue}'</label>
      </div>
      {incomes?.length > 0 && (
        <div className={"searchresults-wrapper__incomes"}>
          <div className={"header"}>
            <label>INCOMES </label>
            <div className={"line"}></div>
          </div>
          <div className={"content"}>
            <div className={"items"}>
              {shownIncomes?.map((t) => (
                <TransactionItem
                  key={t.id}
                  transaction={t}
                  setTransactionPopup={setTransactionPopup}
                  getAccountCurrency={getAccountCurrency}
                  global={global}
                />
              ))}
              <div className={"items-footer"}>
                {shownIncomes.length !== incomes.length &&
                  incomes.length > 5 && (
                    <button
                      onClick={() =>
                        updateShownTransactions({
                          which: "incomes",
                          showOrHide: "show",
                        })
                      }
                      className={"more-less-button"}
                    >
                      Show More
                    </button>
                  )}
                {shownIncomes.length > 5 && (
                  <button
                    onClick={() =>
                      updateShownTransactions({
                        which: "incomes",
                        showOrHide: "hide",
                      })
                    }
                    className={"more-less-button"}
                  >
                    Show Less
                  </button>
                )}
                {shownIncomes.length !== incomes.length && (
                  <button
                    onClick={() => showAll("incomes")}
                    id={"show-all-btn"}
                  >
                    Show All
                  </button>
                )}
              </div>
            </div>
            <AggregationTable
              transactions={incomes}
              getAccountCurrency={getAccountCurrency}
            />
          </div>
        </div>
      )}
      <hr />
      {expenses?.length > 0 && (
        <div className={"searchresults-wrapper__expenses"}>
          <div className={"header"}>
            <label>EXPENSES</label>
          </div>
          <div className={"content"}>
            <div className={"items"}>
              {shownExpenses?.map((t) => (
                <TransactionItem
                  key={t.id}
                  transaction={t}
                  setTransactionPopup={setTransactionPopup}
                  getAccountCurrency={getAccountCurrency}
                  global={global}
                />
              ))}
              <div className={"items-footer"}>
                {shownExpenses?.length !== expenses?.length &&
                  expenses?.length > 5 && (
                    <button
                      onClick={() =>
                        updateShownTransactions({
                          which: "expenses",
                          showOrHide: "show",
                        })
                      }
                      className={"more-less-button"}
                    >
                      Show More
                    </button>
                  )}
                {shownExpenses.length > 5 && (
                  <button
                    onClick={() =>
                      updateShownTransactions({
                        which: "expenses",
                        showOrHide: "hide",
                      })
                    }
                    className={"more-less-button"}
                  >
                    Show Less
                  </button>
                )}
                {shownExpenses.length !== expenses.length && (
                  <button
                    onClick={() => showAll("expenses")}
                    id={"show-all-btn"}
                  >
                    Show All
                  </button>
                )}
              </div>
            </div>
            <AggregationTable
              transactions={expenses}
              getAccountCurrency={getAccountCurrency}
            />
          </div>
        </div>
      )}
      <hr />
      {transfers?.length > 0 && (
        <div className={"searchresults-wrapper__transfers"}>
          <div className={"header"}>
            <label>TRANSFERS</label>
          </div>
          <div className={"content"}>
            <div className={"items"}>
              {shownTransfers?.map((t) => (
                <TransactionItem
                  key={t.id}
                  transaction={t}
                  setTransactionPopup={setTransactionPopup}
                  getAccountCurrency={getAccountCurrency}
                  global={global}
                />
              ))}
              <div className={"items-footer"}>
                {shownTransfers.length !== transfers.length &&
                  transfers.length > 5 && (
                    <button
                      onClick={() =>
                        updateShownTransactions({
                          which: "transfers",
                          showOrHide: "show",
                        })
                      }
                      className={"more-less-button"}
                    >
                      Show More
                    </button>
                  )}
                {shownTransfers.length > 5 && (
                  <button
                    onClick={() =>
                      updateShownTransactions({
                        which: "transfers",
                        showOrHide: "hide",
                      })
                    }
                    className={"more-less-button"}
                  >
                    Show Less
                  </button>
                )}

                {shownTransfers.length !== transfers.length && (
                  <button
                    onClick={() => showAll("transfers")}
                    id={"show-all-btn"}
                  >
                    Show All
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {transactionPopup && (
        <TransactionPopup
          transaction={transactionPopup}
          showPopup={setTransactionPopup}
          getAccountCurrency={getAccountCurrency}
          refreshTransactions={global.updateTransactions}
          refreshSearchResults={refreshSearchResults}
        />
      )}
    </div>
  );
};

const AggregationTable = ({ transactions, getAccountCurrency }) => {
  const global = useGlobalContext();
  const [aggs, setAggs] = useState({ sum: 0, mean: 0, median: 0 });

  async function processTransactions() {
    async function getConvertedAmounts() {
      // Get the converted amounts
      let promises = transactions?.map(async (t) => {
        return await currencyService.convert(
          getAccountCurrency(t.account),
          global.globalCurrency,
          t.amount
        );
      });
      if (!promises) {
        return [];
      }
      let amounts = await Promise.all(promises);

      return amounts.map((num) => Number(num));
    }
    let amounts = await getConvertedAmounts();
    //amounts = transactions?.map((o) => o.amount);

    // Get Min and Max
    const minAmount = Math.min(...amounts);
    const maxAmount = Math.max(...amounts);

    // Get num of transactions
    const numberOfTransactions = amounts.length;

    // Calculate Sum
    const sum = amounts?.reduce((sum, val) => sum + val, 0);

    // Calculate Mean
    const mean = sum / amounts?.length;

    // Calculate Median
    const sortedAmounts = [...amounts].sort((a, b) => a - b);
    const middleIndex = Math.floor(sortedAmounts.length / 2);
    const median =
      sortedAmounts.length % 2 === 0
        ? (sortedAmounts[middleIndex - 1] + sortedAmounts[middleIndex]) / 2
        : sortedAmounts[middleIndex];

    // Calculate timeframe
    const dates = transactions.map((t) => new Date(t.created_on));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    // difference in days
    const diffTime = Math.abs(maxDate - minDate);
    const daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // difference in months
    const yearDiff = maxDate.getFullYear() - minDate.getFullYear();
    let monthDiff = maxDate.getMonth() - minDate.getMonth();
    monthDiff = yearDiff * 12 + monthDiff;

    let difference = 0;
    difference = daysDiff > 90 ? monthDiff + " months" : daysDiff + " days";

    const maxDateStr = maxDate.toDateString().split(" ").slice(1).join(" ");
    const minDateStr = minDate.toDateString().split(" ").slice(1).join(" ");

    setAggs({
      sum,
      mean,
      median,
      minAmount,
      maxAmount,
      numberOfTransactions,
      minDateStr,
      maxDateStr,
      difference,
    });
  }

  useEffect(() => {
    if (typeof transactions === "undefined" || transactions?.length == 0) {
      return;
    }
    processTransactions();
  }, [transactions]);
  return (
    <div className={"aggs-card"}>
      <label>Summary</label>
      <table className={"aggs-table"}>
        <tbody>
          <tr>
            <td className={"measurement"}>Total: </td>
            <td>
              {" "}
              {helper.showOrMask(
                global.privacyMode,
                helper.formatNumber(aggs["sum"])
              )}{" "}
              {helper.getCurrency(global.globalCurrency)}{" "}
            </td>
          </tr>
          <tr>
            <td className={"measurement"}>Mean: </td>
            <td>
              {" "}
              {helper.showOrMask(
                global.privacyMode,
                helper.formatNumber(aggs["mean"])
              )}{" "}
              {helper.getCurrency(global.globalCurrency)}{" "}
            </td>
          </tr>
          <tr>
            <td className={"measurement"}>Median: </td>
            <td>
              {" "}
              {helper.showOrMask(
                global.privacyMode,
                helper.formatNumber(aggs["median"])
              )}{" "}
              {helper.getCurrency(global.globalCurrency)}{" "}
            </td>
          </tr>
          <tr>
            <td className={"measurement"}>Min | Max: </td>
            <td>
              {" "}
              {helper.showOrMask(
                global.privacyMode,
                helper.formatNumber(aggs["minAmount"])
              )}{" "}
              {helper.getCurrency(global.globalCurrency)}
              {" | "}
              {helper.showOrMask(
                global.privacyMode,
                helper.formatNumber(aggs["maxAmount"])
              )}{" "}
              {helper.getCurrency(global.globalCurrency)}{" "}
            </td>
          </tr>
          <tr>
            <td className={"measurement"}># of transactions: </td>
            <td> {aggs["numberOfTransactions"]}</td>
          </tr>
          {aggs["minDateStr"] !== aggs["maxDateStr"] && (
            <tr>
              <td className={"measurement"}>Timeframe:</td>
              <td>
                {aggs["minDateStr"]} - {aggs["maxDateStr"]} (
                {aggs["difference"]})
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const TransactionItem = ({
  transaction,
  getAccountCurrency,
  setTransactionPopup,
  global,
}) => {
  const account =
    "account" in transaction ? transaction.account : transaction.from_account;
  const currency = helper.getCurrency(getAccountCurrency(account));
  const [type, setType] = useState("");

  useEffect(() => {
    function getTransactionType() {
      if ("expense_category" in transaction) {
        return "expense";
      }
      if ("income_category" in transaction) {
        return "income";
      }
      return "transfer";
    }

    setType(getTransactionType());
  }, [transaction]);

  return (
    <div
      className={"transaction-item"}
      onClick={() => setTransactionPopup(transaction)}
    >
      <div>
        {type === "expense" && (
          <>
            <img
              alt="transaction-type"
              src={process.env.PUBLIC_URL + "/expense_arrow.png"}
              width="18"
              height="18"
            />
            Spent{" "}
            {helper.showOrMask(
              global.privacyMode,
              helper.formatNumber(transaction.amount)
            )}{" "}
            {helper.getCurrency(getAccountCurrency(transaction.account))} on{" "}
            {transaction.date} from{" "}
            {helper.getAccountName(global.accounts, transaction.account)}.
          </>
        )}

        {type === "income" && (
          <>
            <img
              alt="transaction-type"
              src={process.env.PUBLIC_URL + "/income_arrow.png"}
              width="18"
              height="18"
            />
            Earned{" "}
            {helper.showOrMask(
              global.privacyMode,
              helper.formatNumber(transaction.amount)
            )}{" "}
            {helper.getCurrency(getAccountCurrency(transaction.account))} on{" "}
            {transaction.date} into{" "}
            {helper.getAccountName(global.accounts, transaction.account)}.
          </>
        )}
        {type === "transfer" && (
          <>
            <img
              alt="transaction-type"
              src={process.env.PUBLIC_URL + "/transfer_arrow.png"}
              width="18"
              height="18"
            />
            Transfered{" "}
            {helper.showOrMask(
              global.privacyMode,
              helper.formatNumber(transaction.amount)
            )}{" "}
            {helper.getCurrency(getAccountCurrency(transaction.from_account))}{" "}
            from{" "}
            {helper.getAccountName(global.accounts, transaction.from_account)}{" "}
            to {helper.getAccountName(global.accounts, transaction.to_account)}{" "}
            on {transaction.date}.
          </>
        )}
      </div>
      {transaction.description?.length > 0 && (
        <div className={"description"}>
          <label>Description: </label>
          <span>
            <i>{transaction.description}</i>
          </span>
        </div>
      )}
      {transaction.tags?.length > 0 && (
        <div className={"tags"}>
          {transaction?.tags?.map((tag) => (
            <span key={tag.name} className={"tag"}>
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchResults;
