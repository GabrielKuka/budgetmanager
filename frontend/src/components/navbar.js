import React, { useState, useEffect, useRef } from "react";
import { useGlobalContext } from "../context/GlobalContext";
import { useNavigate } from "react-router-dom";
import "./navbar.scss";
import ConversionTool from "./core/conversiontool";

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
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState(global.accounts);
  const [expenses, setExpenses] = useState(global.expenses);
  const [incomes, setIncomes] = useState(global.incomes);
  const [transfers, setTransfers] = useState(global.transfers);
  const [searchResults, setSearchResults] = useState(null);
  const [searchValue, setSearchValue] = useState(null);

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

  const handleLogout = () => {
    global.logoutUser();
  };

  const fullname = useRef(global.user.data.name);

  const buttons = ["dashboard", "accounts", "profile", "stats", "templates"];
  const [conversionTool, setConversionTool] = useState(false);

  useEffect(() => {
    let location = window.location.pathname.replace("/", "");
    const activeButton = location
      ? document.getElementById(location)
      : document.getElementById("dashboard");
    if (activeButton) {
      activeButton.style.fontWeight = "bold";
    }
  }, []);

  function handlePage(e) {
    const selected = e.target.innerText.toLowerCase();
    navigate(selected);

    buttons.forEach((button) => {
      const btn = document.getElementById(button);
      if (btn && btn.style != null) {
        btn.style.fontWeight = selected == button ? "bold" : "normal";
      }
    });
  }

  function search(e) {
    const searchValue = e.target.value.toLowerCase();
    const results = [];
    expenses?.forEach((expense) => {
      const tagsLowerCase = expense.tags?.map((t) => t?.name?.toLowerCase());
      if (
        expense.description?.toLowerCase().includes(searchValue) ||
        tagsLowerCase.includes(searchValue)
      ) {
        results.push(expense);
      }
    });

    incomes?.forEach((income) => {
      const tagsLowerCase = income.tags?.map((t) => t?.name?.toLowerCase());
      if (
        income.description?.toLowerCase().includes(searchValue) ||
        tagsLowerCase.includes(searchValue)
      ) {
        results.push(income);
      }
    });

    transfers?.forEach((transfer) => {
      const tagsLowerCase = transfer.tags?.map((t) => t?.name?.toLowerCase());
      if (
        transfer.description?.toLowerCase().includes(searchValue) ||
        tagsLowerCase.includes(searchValue)
      ) {
        results.push(transfer);
      }
    });
    setSearchValue(searchValue);
    setSearchResults(results);
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
          onChange={(e) => search(e)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              console.log(searchResults);
              document.getElementById("search-field").value = "";
              navigate("/searchresults", {
                state: {
                  searchResults: searchResults,
                  searchValue: searchValue,
                },
              });
            }
          }}
        />
        <input
          className={"search-button"}
          id={"search-button"}
          type="image"
          src={process.env.PUBLIC_URL + "/search_icon.png"}
          alt="search_icon"
          onClick={() => {
            document.getElementById("search-field").value = "";
            navigate("/searchresults", {
              state: { searchResults, searchValue },
            });
          }}
        />
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
      <button id="stats" onClick={(e) => handlePage(e)}>
        Stats
      </button>
      <button id="converter" onClick={() => setConversionTool(true)}>
        Convert Currency
      </button>
      {conversionTool && (
        <ConversionTool closePopup={() => setConversionTool(false)} />
      )}
      <button onClick={handleLogout}>Log out</button>
    </div>
  );
};

const LoggedOutNavbar = () => {
  return <div>Logged out</div>;
};
