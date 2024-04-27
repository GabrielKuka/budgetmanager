import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
      <Sidebar
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

const Sidebar = ({ page, setPage, dateRange, setDateRange }) => {
  const buttons = ["incomes", "expenses", "transfers"];

  useEffect(() => {
    if (page) {
      const activeButtonStyle = document.getElementById(page).style;
      activeButtonStyle.borderRight = "2px solid cadetblue";
    }
  }, []);

  function handlePage(e) {
    //const selected = e.target.innerText.toLowerCase();
    const selected = e.target.id;
    setPage(selected);

    buttons.forEach((button) => {
      const buttonStyle = document.getElementById(button).style;
      if (selected == button) {
        buttonStyle.borderRight = "2px solid cadetblue";
      } else {
        buttonStyle.borderRight = "0";
      }
    });
  }
  return (
    <div className={"dashboard-wrapper__sidebar"}>
      <input
        type="image"
        id="incomes"
        onClick={(e) => handlePage(e)}
        src={process.env.PUBLIC_URL + "/income_icon.png"}
        width={30}
        height={30}
      />
      <input
        type="image"
        id="expenses"
        onClick={(e) => handlePage(e)}
        src={process.env.PUBLIC_URL + "/expense_icon.png"}
        width={30}
        height={30}
      />
      <input
        type="image"
        id="transfers"
        onClick={(e) => handlePage(e)}
        src={process.env.PUBLIC_URL + "/transfer_icon.png"}
        width={30}
        height={30}
      />
    </div>
  );
};

const Toolbar = ({ page, setPage, dateRange, setDateRange }) => {
  return (
    <div className={"dashboard-wrapper__toolbar"}>
      <button id="incomes">Incomes</button>
      <button id="expenses">Expenses</button>
      <button id="transfers">Transfers</button>
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
