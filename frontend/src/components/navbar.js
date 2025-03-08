import React, { useState, useEffect, useRef } from "react";
import { useGlobalContext } from "../context/GlobalContext";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import "./navbar.scss";
import ConversionTool from "./core/conversiontool";
import { helper } from "./helper";
import TransactionPopup from "./core/transaction_popup";
import { useToast } from "../context/ToastContext";
import searchService from "../services/searchService";
import { useConfirm } from "../context/ConfirmContext";
import AddTransactionPopup from "./dashboard/addTransactionPopup";

const Navbar = () => {
  const global = useGlobalContext();
  return (
    <div className={"navbar-wrapper"}>
      {global.authToken ? <LoggedInNavbar /> : <LoggedOutNavbar />}
    </div>
  );
};

export default Navbar;

const LoggedInNavbar = () => {
  const global = useGlobalContext();
  const showToast = useToast();
  const showConfirm = useConfirm();

  const [accounts, setAccounts] = useState(global.accounts);
  const [expenses, setExpenses] = useState(global.expenses);
  const [incomes, setIncomes] = useState(global.incomes);
  const [transfers, setTransfers] = useState(global.transfers);
  const [searchResults, setSearchResults] = useState(null);
  const [searchValue, setSearchValue] = useState(null);
  const [suggestionBox, setSuggestionBox] = useState(false);
  const [transactionPopup, setTransactionPopup] = useState(false);
  const [addTransactionPopup, setAddTransactionPopup] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const possibleLocations = ["dashboard", "accounts", "templates"];
    const currentLocation = location.pathname.split("/")[1];

    possibleLocations.forEach((id) => {
      const btn = document.getElementById(id);
      btn.style.fontWeight = "normal";
    });

    if (possibleLocations.includes(currentLocation)) {
      const btn = document.getElementById(currentLocation);
      btn.style.fontWeight = "bold";
    }
  }, [location.pathname]);

  useEffect(() => {
    let location = window.location.pathname.replace("/", "");
    const activeButton = location
      ? document.getElementById(location)
      : document.getElementById("dashboard");
    if (activeButton) {
      activeButton.style.fontWeight = "bold";
    }
  }, []);

  useEffect(() => {}, [global.privacyMode]);

  useEffect(() => {
    if (searchResults?.length > 0) {
      setSuggestionBox(true);
    } else {
      setSuggestionBox(false);
    }
  }, [searchResults]);

  useEffect(() => {
    setAccounts(global.accounts);
  }, [global.accounts]);

  useEffect(() => {
    setExpenses(global.expenses);
  }, [global.expenses]);

  useEffect(() => {
    setIncomes(global.incomes);
  }, [global.incomes]);

  useEffect(() => {
    setTransfers(global.transfers);
  }, [global.transfers]);

  function getAccountCurrency(id) {
    const account = accounts?.filter((a) => a.id === parseInt(id));
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  function refreshSearchResults(id) {
    setSearchResults(searchResults.filter((t) => t.id != id));
  }

  const handleLogout = () => {
    console.log("Hello");
    showConfirm(
      `Are you sure you want to logout ${global.user.data.name}?`,
      () => {
        global.logoutUser();
        showToast("Logged out.");
      }
    );
  };

  const fullname = useRef(global.user.data.name);

  const [conversionTool, setConversionTool] = useState(false);

  function handlePage(e) {
    const selected = e.target.innerText.toLowerCase();
    navigate(selected);
  }

  const updateDebounceSearch = debounceSearch((searchValue) => {
    search(searchValue);
  });

  function debounceSearch(cb, delay = 500) {
    let timeout;

    return (...args) => {
      clearTimeout(timeout);
      setSuggestionBox(false);
      timeout = setTimeout(() => {
        cb(...args);
      }, delay);
    };
  }

  async function search(searchValue) {
    if (
      !searchValue ||
      searchValue === undefined ||
      searchValue === "" ||
      searchValue === null
    ) {
      setSuggestionBox(false);
      return;
    }
    const query = searchValue.toLowerCase();

    const searchData = await searchService.search(query);

    const result = Object.values(searchData).flat();
    setSearchResults(result);
    setSearchValue(searchValue);
  }

  function changeGlobalCurrency(event) {
    global.changeGlobalCurrency(event.target.value);
  }

  return (
    <div className={"navbar-wrapper__loggedin"}>
      <div className={"fullname-container"} onClick={() => navigate("profile")}>
        <img
          alt="user-icon"
          className={"user-icon"}
          src={process.env.PUBLIC_URL + "/user-icon.png"}
        />
        <label className={"fullname"}>{fullname.current}</label>
      </div>
      <div className={"search-container"}>
        <input
          type="text"
          id="search-field"
          className={"search-field"}
          placeholder="Search..."
          autoComplete="off"
          onClick={(e) => {
            if (e.target.value === "") {
              setSuggestionBox(false);
            }
          }}
          onChange={(e) => updateDebounceSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && searchValue) {
              const query = document.getElementById("search-field").value;
              document.getElementById("search-field").value = "";
              document.getElementById("search-field").blur();
              setSearchParams({ q: query });
              navigate(`/searchResults?q=${query}`, {
                state: {
                  searchResults:
                    suggestionBox && query ? searchResults : "nothing",
                  searchValue: query,
                },
              });
              setSuggestionBox(false);
            }
          }}
        />
        <input
          className={"search-button"}
          id={"search-button"}
          type="image"
          src={process.env.PUBLIC_URL + "/search_icon.png"}
          alt="search_icon"
          onFocus={() => {
            if (!searchValue) {
              return;
            }
            setSuggestionBox(!suggestionBox);
            document.getElementById("search-field").value = "";

            navigate(`/searchresults/${searchValue}`, {
              state: { searchResults, searchValue },
            });
          }}
        />
        {suggestionBox && (
          <div className={"suggestions-container"}>
            {searchResults
              ?.sort((a, b) => (a.date > b.date ? -1 : 1))
              ?.slice(0, 5)
              ?.map((s) => (
                <SuggestionItem
                  key={`${s.id}`}
                  suggestion={s}
                  getAccountCurrency={getAccountCurrency}
                  setTransactionPopup={setTransactionPopup}
                  global={global}
                />
              ))}
          </div>
        )}
      </div>
      <button id="dashboard" onClick={(e) => handlePage(e)}>
        Dashboard
      </button>
      <button id="accounts" onClick={(e) => handlePage(e)}>
        Accounts
      </button>
      <button id="templates" onClick={(e) => handlePage(e)}>
        Templates
      </button>
      <select
        id="global_currency"
        value={global.globalCurrency}
        onChange={changeGlobalCurrency}
      >
        <option value="EUR">EUR</option>
        <option value="USD">USD</option>
        <option value="ALL">ALL</option>
        <option value="BGN">BGN</option>
      </select>
      <input
        type="button"
        id="add_transaction_btn"
        value="+"
        title="Add a transaction"
        onClick={() => setAddTransactionPopup(true)}
      />
      <input
        id={"privacy_btn"}
        title="Toggle Privacy Mode"
        type="image"
        src={
          process.env.PUBLIC_URL +
          (global.privacyMode ? "/locker_closed.png" : "/locker_open.png")
        }
        alt="privacy_mode_icon"
        onClick={global.togglePrivacyMode}
      />
      <input
        id={"converter"}
        title="Convert Currencies"
        type="image"
        src={process.env.PUBLIC_URL + "/currency_convert_icon.png"}
        alt="currency_convert_icon"
        onClick={() => setConversionTool(true)}
      />
      {conversionTool && (
        <ConversionTool closePopup={() => setConversionTool(false)} />
      )}
      <input
        className={"logout-button"}
        id={"logout-button"}
        type="image"
        src={process.env.PUBLIC_URL + "/logout_icon.png"}
        alt="logout_icon"
        onClick={handleLogout}
      />
      {transactionPopup && (
        <TransactionPopup
          transaction={transactionPopup}
          showPopup={setTransactionPopup}
          getAccountCurrency={getAccountCurrency}
          refreshTransactions={global.updateTransactions}
          refreshSearchResults={refreshSearchResults}
        />
      )}
      {addTransactionPopup && (
        <AddTransactionPopup
          getAccountCurrency={getAccountCurrency}
          showPopup={setAddTransactionPopup}
          refreshAccounts={global.updateAccounts}
        />
      )}
    </div>
  );
};

const SuggestionItem = ({
  suggestion,
  getAccountCurrency,
  setTransactionPopup,
  global,
}) => {
  const account =
    "account" in suggestion ? suggestion.account : suggestion.from_account;
  const currency = helper.getCurrency(getAccountCurrency(account));

  function getSuggestionType() {
    if ("income_category" in suggestion) {
      return "income";
    } else if ("expense_category" in suggestion) {
      return "expense";
    } else {
      return "transfer";
    }
  }

  return (
    <div
      className={"suggestion-item"}
      onClick={() => {
        setTransactionPopup(suggestion);
      }}
    >
      <div className={"date"}>
        <b>Date: </b>
        <span>{suggestion.date}</span>
        <span className={"suggestion-type"}>{getSuggestionType()}</span>
      </div>
      {suggestion.description?.length > 0 && (
        <div className={"description"}>
          <b>Description: </b>
          <span>{suggestion.description}</span>
        </div>
      )}
      <div className={"amount"}>
        <b>Amount: </b>
        <span>
          {helper.showOrMask(
            global.privacyMode,
            parseFloat(suggestion.amount).toFixed(2)
          )}{" "}
          {currency}
        </span>
      </div>
      {suggestion.tags?.length > 0 && (
        <div className={"tags"}>
          <b>Tags: </b>

          {suggestion?.tags?.map((tag) => (
            <span key={tag.name} className={"tag"}>
              {tag.name}
            </span>
          ))}
        </div>
      )}
      <hr />
    </div>
  );
};

const LoggedOutNavbar = () => {
  return (
    <div className="navbar-wrapper__loggedout">
      <label>BudgetManager</label>
    </div>
  );
};
