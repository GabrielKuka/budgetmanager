import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGlobalContext } from "../../context/GlobalContext";
import { Navigate } from "react-router-dom";
import "./dashboard.scss";
import Expenses from "./expenses";
import Incomes from "./incomes";
import Transfers from "./transfers";

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
      <Toolbar setPage={setPage} page={page} />
      {page === "expenses" && <Expenses />}
      {page === "incomes" && <Incomes />}
      {page === "transfers" && <Transfers />}
    </div>
  );
};

const Toolbar = ({ page, setPage }) => {
  const buttons = ["incomes", "expenses", "transfers"];

  useEffect(() => {
    if (page) {
      document.getElementById(page).style.fontWeight = "bold";
    }
  }, []);

  function handlePage(e) {
    const selected = e.target.innerText.toLowerCase();
    setPage(selected);

    buttons.forEach((button) => {
      document.getElementById(button).style.fontWeight =
        selected == button ? "bold" : "normal";
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
    </div>
  );
};

export default Dashboard;
