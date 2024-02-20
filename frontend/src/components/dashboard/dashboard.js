import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGlobalContext } from "../../context/GlobalContext";
import { Navigate } from "react-router-dom";
import "./dashboard.scss";
import Expenses from "./expenses";
import Incomes from "./incomes";
import Transfers from "./transfers";
import DatePicker from "react-datepicker";

const Dashboard = () => {
  const global = useGlobalContext();
  const navigate = useNavigate();

  const initLocation =
    window.location.pathname.endsWith("dashboard") ||
    window.location.pathname.endsWith("dashboard/") ||
    window.location.pathname.endsWith("/")
      ? "expenses"
      : window.location.pathname.split("/").slice(-1)[0];
  const [page, setPage] = useState(initLocation);

  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });

  useEffect(() => {
    navigate(`/dashboard/${page}`);
  }, [page]);

  if (!global.authToken) {
    return <Navigate push to="/login" />;
  }

  return (
    <div className={"dashboard-wrapper"}>
      <Toolbar
        setPage={setPage}
        page={page}
        dateRange={dateRange}
        setDateRange={setDateRange}
      />
      {page === "expenses" && <Expenses dateRange={dateRange} />}
      {page === "incomes" && <Incomes dateRange={dateRange} />}
      {page === "transfers" && <Transfers dateRange={dateRange} />}
    </div>
  );
};

const Toolbar = ({ page, setPage, dateRange, setDateRange }) => {
  const buttons = ["incomes", "expenses", "transfers"];

  useEffect(() => {
    if (page) {
      const activeButtonStyle = document.getElementById(page).style;
      activeButtonStyle.fontWeight = "bold";
      activeButtonStyle.color = "white";
      activeButtonStyle.backgroundColor = "cadetblue";
      activeButtonStyle.borderRadius = "5px";
    }
  }, []);

  function handlePage(e) {
    const selected = e.target.innerText.toLowerCase();
    setPage(selected);

    buttons.forEach((button) => {
      const buttonStyle = document.getElementById(button).style;
      if (selected == button) {
        buttonStyle.fontWeight = "bold";
        buttonStyle.color = "white";
        buttonStyle.backgroundColor = "cadetblue";
        buttonStyle.borderRadius = "5px";
      } else {
        buttonStyle.fontWeight = "normal";
        buttonStyle.color = "cadetblue";
        buttonStyle.backgroundColor = "white";
        buttonStyle.borderRadius = "2px";
      }
    });
  }

  return (
    <div className={"dashboard-wrapper__toolbar"}>
      <button id="incomes" onClick={(e) => handlePage(e)}>
        Incomes
      </button>
      <button id="expenses" onClick={(e) => handlePage(e)}>
        Expenses
      </button>
      <button id="transfers" onClick={(e) => handlePage(e)}>
        Transfers
      </button>
      <div className={"date-filter"}>
        <div className={"fromDatePicker"}>
          <span className={"tooltip"}>From: </span>
          <DatePicker
            className="datepicker"
            selected={dateRange.from}
            onChange={(date) =>
              setDateRange((prev) => ({
                ...prev,
                from: date,
              }))
            }
            showMonthDropdown
            dateFormat={"yyyy-MM-dd"}
          />
        </div>
        <div className={"toDatePicker"}>
          <span className={"tooltip"}>To:</span>
          <DatePicker
            className="datepicker"
            selected={dateRange.to}
            onChange={(date) =>
              setDateRange((prev) => ({
                ...prev,
                to: date,
              }))
            }
            showMonthDropdown
            dateFormat={"yyyy-MM-dd"}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
