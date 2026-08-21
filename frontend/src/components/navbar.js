import React, { useState, useEffect, useRef } from "react";
import { useGlobalContext } from "../context/GlobalContext";
import {
  Link,
  useNavigate,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import "./navbar.scss";
import ConversionTool from "./core/conversiontool";
import { helper } from "./helper";
import TransactionPopup from "./core/transaction_popup";
import { useToast } from "../context/ToastContext";
import searchService from "../services/searchService";
import { useConfirm } from "../context/ConfirmContext";
import TransactionComposer from "./core/transactionComposer";
import { useThemeContext } from "../context/ThemeContext";

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
  const { isDarkMode, toggleTheme } = useThemeContext();
  const showToast = useToast();
  const showConfirm = useConfirm();

  const [accounts, setAccounts] = useState(global.accounts);
  const [searchResults, setSearchResults] = useState(null);
  const [searchValue, setSearchValue] = useState(null);
  const [suggestionBox, setSuggestionBox] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [transactionPopup, setTransactionPopup] = useState(false);
  const [transactionComposer, setTransactionComposer] = useState(false);
  const [utilityMenu, setUtilityMenu] = useState(false);
  const searchInputRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const searchRequestRef = useRef(0);

  const navigate = useNavigate();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();

  useEffect(() => {
    const possibleLocations = ["dashboard", "accounts", "assets"];
    const currentLocation = location.pathname.split("/")[1];

    possibleLocations.forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.style.fontWeight = "normal";
    });

    if (possibleLocations.includes(currentLocation)) {
      const btn = document.getElementById(currentLocation);
      if (btn) btn.style.fontWeight = "bold";
    }
  }, [location.pathname]);

  useEffect(() => {
    if (searchResults?.length > 0) {
      setSuggestionBox(true);
    } else {
      setSuggestionBox(false);
    }
  }, [searchResults]);

  const visibleSearchResults = [...(searchResults || [])]
    .sort((a, b) => (a.date > b.date ? -1 : 1))
    .slice(0, 5);

  function selectSuggestion(suggestion) {
    clearTimeout(searchDebounceRef.current);
    searchRequestRef.current += 1;
    setSuggestionBox(false);
    setActiveSuggestion(-1);
    setSearchResults(null);
    setSearchValue("");
    setTransactionPopup(suggestion);
  }

  useEffect(() => {
    setAccounts(global.accounts);
  }, [global.accounts]);

  useEffect(() => () => clearTimeout(searchDebounceRef.current), []);

  function getAccountCurrency(id) {
    const account = accounts?.filter((a) => a.id === parseInt(id));
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  function refreshSearchResults(id) {
    setSearchResults((current) => current?.filter((t) => t.id !== id) || []);
  }

  const handleLogout = () => {
    showConfirm(
      `Are you sure you want to logout ${global.user.data.name}?`,
      () => {
        global.logoutUser();
        showToast("Logged out.");
      },
      { variant: "info", confirmLabel: "Log out" }
    );
  };

  const fullname = useRef(global.user.data.name);

  const [conversionTool, setConversionTool] = useState(false);

  function handlePage(e) {
    const selected = e.target.innerText.toLowerCase();
    navigate(selected);
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
    const requestId = ++searchRequestRef.current;

    const searchData = await searchService.search(query);
    if (requestId !== searchRequestRef.current) return;

    const result = searchData.results || Object.values(searchData).flat();
    setSearchResults(result);
    setSearchValue(searchValue);
  }

  function changeGlobalCurrency(event) {
    global.changeGlobalCurrency(event.target.value);
  }

  const goTo = (path) => {
    navigate(path);
    setUtilityMenu(false);
  };
  const activePath = location.pathname.split("/")[1] || "dashboard";

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
          ref={searchInputRef}
          value={searchValue || ""}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={suggestionBox}
          aria-controls="navbar-search-results"
          aria-activedescendant={
            activeSuggestion >= 0
              ? `search-option-${activeSuggestion}`
              : undefined
          }
          onClick={(e) => {
            if (e.target.value === "") {
              setSuggestionBox(false);
            }
          }}
          onChange={(e) => {
            const value = e.target.value;
            setSearchValue(value);
            setActiveSuggestion(-1);
            setSuggestionBox(false);
            clearTimeout(searchDebounceRef.current);
            searchDebounceRef.current = setTimeout(() => search(value), 500);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && visibleSearchResults.length) {
              e.preventDefault();
              setSuggestionBox(true);
              setActiveSuggestion((current) =>
                Math.min(current + 1, visibleSearchResults.length - 1)
              );
            } else if (e.key === "ArrowUp" && visibleSearchResults.length) {
              e.preventDefault();
              setActiveSuggestion((current) => Math.max(current - 1, 0));
            } else if (e.key === "Escape") {
              clearTimeout(searchDebounceRef.current);
              searchRequestRef.current += 1;
              setSuggestionBox(false);
              setActiveSuggestion(-1);
            } else if (
              e.key === "Enter" &&
              activeSuggestion >= 0 &&
              visibleSearchResults[activeSuggestion]
            ) {
              e.preventDefault();
              selectSuggestion(visibleSearchResults[activeSuggestion]);
            } else if (e.key === "Enter" && searchValue) {
              const query = searchValue;
              clearTimeout(searchDebounceRef.current);
              searchRequestRef.current += 1;
              setSearchValue("");
              searchInputRef.current?.blur();
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
          onClick={(event) => {
            event.preventDefault();
            if (!searchValue) {
              return;
            }
            const query = searchValue;
            setSuggestionBox(false);
            setSearchValue("");
            navigate(`/searchresults?q=${encodeURIComponent(query)}`);
          }}
        />
        {suggestionBox && (
          <div
            id="navbar-search-results"
            className="suggestions-container"
            role="listbox"
            aria-label="Search results"
          >
            {visibleSearchResults.map((s, index) => (
              <SuggestionItem
                key={`${s.id}`}
                id={`search-option-${index}`}
                suggestion={s}
                getAccountCurrency={getAccountCurrency}
                onSelect={() => selectSuggestion(s)}
                active={activeSuggestion === index}
                onActive={() => setActiveSuggestion(index)}
                global={global}
              />
            ))}
          </div>
        )}
      </div>
      <div className="primary-nav">
        <button id="dashboard" onClick={(e) => handlePage(e)}>
          Dashboard
        </button>
        <button id="accounts" onClick={(e) => handlePage(e)}>
          Accounts
        </button>
        <button id="assets" onClick={(e) => handlePage(e)}>
          Assets
        </button>
      </div>
      <div className="navbar-actions">
        <select
          id="global_currency"
          value={global.globalCurrency}
          onChange={changeGlobalCurrency}
          title="Global currency"
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
          onClick={() => setTransactionComposer(true)}
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
        <button
          type="button"
          id="theme-toggle"
          className={isDarkMode ? "active" : ""}
          title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={
            isDarkMode ? "Switch to light mode" : "Switch to dark mode"
          }
          onClick={toggleTheme}
        >
          {isDarkMode ? <SunIcon /> : <MoonIcon />}
        </button>
        <input
          className={"logout-button"}
          id={"logout-button"}
          type="image"
          src={process.env.PUBLIC_URL + "/logout_icon.png"}
          alt="logout_icon"
          onClick={handleLogout}
        />
        <button
          type="button"
          className="mobile-utility-button"
          aria-label="Open utility menu"
          aria-expanded={utilityMenu}
          onClick={() => setUtilityMenu(!utilityMenu)}
        >
          •••
        </button>
      </div>
      {utilityMenu && (
        <div className="mobile-utility-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={global.togglePrivacyMode}
          >
            {global.privacyMode
              ? "Disable privacy mode"
              : "Enable privacy mode"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setConversionTool(true);
              setUtilityMenu(false);
            }}
          >
            Currency converter
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              toggleTheme();
              setUtilityMenu(false);
            }}
          >
            {isDarkMode ? "Use light theme" : "Use dark theme"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => goTo("/profile")}
          >
            Profile and settings
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              setUtilityMenu(false);
              handleLogout();
            }}
          >
            Log out
          </button>
        </div>
      )}
      <nav className="mobile-bottom-nav" aria-label="Primary navigation">
        {[
          {
            path: "/dashboard",
            key: "dashboard",
            icon: "⌂",
            label: "Dashboard",
          },
          { path: "/accounts", key: "accounts", icon: "▤", label: "Accounts" },
          { path: "/assets", key: "assets", icon: "◇", label: "Assets" },
          { path: "/profile", key: "profile", icon: "○", label: "Profile" },
        ].map((item) => (
          <button
            type="button"
            key={item.key}
            className={activePath === item.key ? "is-active" : ""}
            aria-current={activePath === item.key ? "page" : undefined}
            onClick={() => goTo(item.path)}
          >
            <span aria-hidden="true">{item.icon}</span>
            <small>{item.label}</small>
          </button>
        ))}
      </nav>
      {conversionTool && (
        <ConversionTool closePopup={() => setConversionTool(false)} />
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
      {transactionComposer && (
        <TransactionComposer onClose={() => setTransactionComposer(false)} />
      )}
    </div>
  );
};

export const SuggestionItem = ({
  id,
  suggestion,
  getAccountCurrency,
  onSelect,
  active,
  onActive,
  global,
}) => {
  const transactionType = suggestion["transaction_type"];
  const account =
    transactionType === "expense" ||
    transactionType === "transfer" ||
    transactionType === "buy"
      ? suggestion.from_account
      : suggestion.to_account;
  const currency = helper.getCurrency(getAccountCurrency(account));

  return (
    <button
      type="button"
      id={id}
      role="option"
      aria-selected={active}
      className={`suggestion-item${active ? " is-active" : ""}`}
      onMouseEnter={onActive}
      onFocus={onActive}
      onClick={onSelect}
    >
      <div className={"date"}>
        <label>Date: </label>
        <span>{suggestion.date}</span>
        <span className={`suggestion-type suggestion-type--${transactionType}`}>
          {transactionType}
        </span>
      </div>
      {suggestion.description?.length > 0 && (
        <div className={"description"}>
          <label>Description: </label>
          <span>{suggestion.description}</span>
        </div>
      )}
      <div className={"amount"}>
        <label>Amount: </label>
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
          <label>Tags: </label>

          {suggestion?.tags?.map((tag) => (
            <span key={tag.name} className={"tag"}>
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </button>
  );
};

const LoggedOutNavbar = () => {
  const { isDarkMode, toggleTheme } = useThemeContext();
  return (
    <div className="navbar-wrapper__loggedout">
      <Link className="auth-navbar__brand" to="/login">
        <span aria-hidden="true">B</span>
        BudgetManager
      </Link>
      <button
        type="button"
        className="auth-navbar__theme-toggle"
        aria-label={isDarkMode ? "Use light theme" : "Use dark theme"}
        title={isDarkMode ? "Use light theme" : "Use dark theme"}
        onClick={toggleTheme}
      >
        {isDarkMode ? <SunIcon /> : <MoonIcon />}
      </button>
    </div>
  );
};

const SunIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.99 13.08A8 8 0 1 1 10.92 3.01 6 6 0 0 0 20.99 13.08Z" />
  </svg>
);
