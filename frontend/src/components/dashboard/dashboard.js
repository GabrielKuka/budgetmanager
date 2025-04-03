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

  useEffect(() => {
    navigate(`/dashboard/${page}`);
  }, [page]);

  if (!global.authToken) {
    return <Navigate push to="/login" />;
  }

  return (
    <div className={"dashboard-wrapper"}>
      <Sidebar setPage={setPage} page={page} />
      {page === "expenses" && <Expenses />}
      {page === "incomes" && <Incomes />}
      {page === "transfers" && <Transfers />}
    </div>
  );
};

const Sidebar = ({ page, setPage }) => {
  const buttons = ["incomes", "expenses", "transfers"];
  const global = useGlobalContext();

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
        className={"sidebar-icon"}
        type="image"
        id="incomes"
        onClick={(e) => handlePage(e)}
        src={process.env.PUBLIC_URL + "/income_icon.png"}
        width={30}
        height={30}
        title="Incomes"
      />
      <input
        className={"sidebar-icon"}
        type="image"
        id="expenses"
        onClick={(e) => handlePage(e)}
        src={process.env.PUBLIC_URL + "/expense_icon.png"}
        width={30}
        height={30}
        title="Expenses"
      />
      <input
        className={"sidebar-icon"}
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
        selected={global.dateRange.from}
        onChange={(date) => {
          return global.setDateRange((prev) => ({
            ...prev,
            from: date,
          }));
        }}
        showMonthDropdown
        title={`FROM: ${global.dateRange.from.toDateString()}`}
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
        selected={global.dateRange.to}
        title={`TO: ${global.dateRange.to.toDateString()}`}
        onChange={(date) =>
          global.setDateRange((prev) => ({
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
