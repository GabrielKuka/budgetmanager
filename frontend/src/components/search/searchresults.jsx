import React, { useState, useEffect } from "react";
import "./searchresults.scss";
import { useGlobalContext } from "../../context/GlobalContext";
import { useLocation } from "react-router-dom";
import { helper } from "../helper";
import TransactionPopup from "../core/transaction_popup";

const SearchResults = (props) => {
  const global = useGlobalContext();
  const accounts = global.accounts;
  const state = useLocation().state;
  const [searchResults, setSearchResults] = useState(state.searchResults);
  const searchValue = state.searchValue;

  const [transactionPopup, setTransactionPopup] = useState(false);

  useEffect(() => {
    setSearchResults(state.searchResults);
  }, [state.searchResults]);

  const incomes = searchResults
    .filter((t) => "income_category" in t)
    .sort((a, b) => (a.date > b.date ? -1 : 1));
  const expenses = searchResults
    .filter((t) => "expense_category" in t)
    .sort((a, b) => (a.date > b.date ? -1 : 1));
  const transfers = searchResults
    .filter((t) => "from_account" in t)
    .sort((a, b) => (a.date > b.date ? -1 : 1));

  function getAccountCurrency(id) {
    const account = accounts?.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  function refreshSearchResults(id) {
    setSearchResults(searchResults.filter((t) => t.id != id));
  }

  return (
    <div className={"searchresults-wrapper"}>
      <div className={"searchresults-wrapper__header"}>
        <label>Search results for: '{searchValue}'</label>
      </div>
      {incomes?.length > 0 && (
        <div className={"searchresults-wrapper__incomes"}>
          <div className={"header"}>
            <label>INCOMES: </label>
            <div className={"line"}></div>
          </div>
          <div className={"content"}>
            <div className={"items"}>
              {incomes?.map((t) => (
                <TransactionItem
                  key={t.id}
                  transaction={t}
                  setTransactionPopup={setTransactionPopup}
                  getAccountCurrency={getAccountCurrency}
                  global={global}
                />
              ))}
            </div>
            <AggregationTable />
          </div>
        </div>
      )}
      {expenses?.length > 0 && (
        <div className={"searchresults-wrapper__expenses"}>
          <div className={"header"}>
            <label>EXPENSES:</label>
          </div>
          <div className={"content"}>
            <div className={"items"}>
              {expenses?.map((t) => (
                <TransactionItem
                  key={t.id}
                  transaction={t}
                  setTransactionPopup={setTransactionPopup}
                  getAccountCurrency={getAccountCurrency}
                  global={global}
                />
              ))}
            </div>
            <AggregationTable transactions={expenses} />
          </div>
        </div>
      )}
      {transfers?.length > 0 && (
        <div className={"searchresults-wrapper__transfers"}>
          <div className={"header"}>
            <label>TRANSFERS:</label>
          </div>
          <div className={"content"}>
            <div className={"items"}>
              {transfers?.map((t) => (
                <TransactionItem
                  key={t.id}
                  transaction={t}
                  setTransactionPopup={setTransactionPopup}
                  getAccountCurrency={getAccountCurrency}
                  global={global}
                />
              ))}
            </div>
            <AggregationTable />
          </div>
        </div>
      )}

      {transactionPopup && (
        <TransactionPopup
          transaction={transactionPopup}
          showPopup={setTransactionPopup}
          getAccountCurrency={getAccountCurrency}
          refreshTransactions={() => {}}
          refreshSearchResults={refreshSearchResults}
        />
      )}
    </div>
  );
};

const AggregationTable = ({ transactions }) => {
  const global = useGlobalContext();
  const [aggs, setAggs] = useState({});

  function getSum() {
    let sum = transactions.reduce((sum, object) => sum + object.amount, 0);
    return helper.formatNumber(sum, 2);
  }

  useEffect(() => {
    // Get the amounts
    const amounts = transactions.map((o) => o.amount);

    // Calculate Sum
    const sum = amounts.reduce((sum, val) => sum + val, 0);

    // Calculate Mean
    const mean = sum / amounts.length;

    // Calculate Median
    const sortedAmounts = [...amounts].sort((a, b) => a - b);
    const middleIndex = Math.floor(sortedAmounts.length / 2);
    const median =
      sortedAmounts.length % 2 === 0
        ? (sortedAmounts[middleIndex - 1] + sortedAmounts[middleIndex]) / 2
        : sortedAmounts[middleIndex];

    setAggs({
      sum,
      mean,
      median,
    });
  }, [transactions]);
  return (
    <div className={"aggs"}>
      <table>
        <tbody>
          <tr>
            <td>Total: </td>
            <td>
              {" "}
              {helper.formatNumber(aggs["sum"])}{" "}
              {helper.getCurrency(global.globalCurrency)}{" "}
            </td>
          </tr>
          <tr>
            <td>Mean: </td>
            <td>
              {" "}
              {helper.formatNumber(aggs["mean"])}{" "}
              {helper.getCurrency(global.globalCurrency)}{" "}
            </td>
          </tr>
          <tr>
            <td>Median: </td>
            <td>
              {" "}
              {helper.formatNumber(aggs["median"])}{" "}
              {helper.getCurrency(global.globalCurrency)}{" "}
            </td>
          </tr>
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

  return (
    <div
      className={"transaction-item"}
      onClick={() => setTransactionPopup(transaction)}
    >
      <div className={"date"}>
        <b>Date: </b>
        <span>{transaction.date}</span>
      </div>
      {transaction.description?.length > 0 && (
        <div className={"description"}>
          <b>Description: </b>
          <span>{transaction.description}</span>
        </div>
      )}
      <div className={"amount"}>
        <b>Amount: </b>
        <span>
          {helper.showOrMask(
            global.privacyMode,
            parseFloat(transaction.amount).toFixed(2)
          )}{" "}
          {currency}
        </span>
      </div>
      {transaction.tags?.length > 0 && (
        <div className={"tags"}>
          <b>Tags: </b>

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
