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
    const selected = e.target.id;
    setPage(selected);

    buttons.forEach((button) => {
      const buttonStyle = document.getElementById(button).style;
      if (selected == button) {
        buttonStyle.borderRight = "2px solid cadetblue";
      } else {
        buttonStyle.borderRight = "2px solid white";
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
        title="Incomes"
      />
      <input
        type="image"
        id="expenses"
        onClick={(e) => handlePage(e)}
        src={process.env.PUBLIC_URL + "/expense_icon.png"}
        width={30}
        height={30}
        title="Expenses"
      />
      <input
        type="image"
        id="transfers"
        onClick={(e) => handlePage(e)}
        src={process.env.PUBLIC_URL + "/transfer_icon.png"}
        width={30}
        height={30}
        title="Transfers"
      />
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
        title={`FROM: ${dateRange.from.toDateString()}`}
        dateFormat={"yyyy-MM-dd"}
        customInput={
          <img
            src={process.env.PUBLIC_URL + "/from_icon.png"}
            width={30}
            height={30}
          />
        }
        withPortal
      />
      <DatePicker
        className="datepicker"
        selected={dateRange.to}
        title={`TO: ${dateRange.to.toDateString()}`}
        onChange={(date) =>
          setDateRange((prev) => ({
            ...prev,
            to: date,
          }))
        }
        showMonthDropdown
        dateFormat={"yyyy-MM-dd"}
        customInput={
          <img
            src={process.env.PUBLIC_URL + "/to_icon.png"}
            width={30}
            height={30}
          />
        }
        withPortal
      />
    </div>
  );
};

export default Dashboard;
