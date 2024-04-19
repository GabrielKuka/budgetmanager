import React, { useState, useEffect } from "react";
import "./searchresults.scss";
import { useGlobalContext } from "../context/GlobalContext";
import { useLocation } from "react-router-dom";
import { helper } from "./helper";
import TransactionPopup from "./core/transaction_popup";

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
        </div>
      )}
      {expenses?.length > 0 && (
        <div className={"searchresults-wrapper__expenses"}>
          <div className={"header"}>
            <label>EXPENSES:</label>
          </div>
          <div className={"content"}>
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
        </div>
      )}
      {transfers?.length > 0 && (
        <div className={"searchresults-wrapper__transfers"}>
          <div className={"header"}>
            <label>TRANSFERS:</label>
          </div>
          <div className={"content"}>
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
