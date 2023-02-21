import React, { useState, useEffect } from "react";
import { useGlobalContext } from "../../context/GlobalContext";
import { Navigate } from "react-router-dom";
import "./dashboard.scss";
import Expenses from "./expenses";
import Incomes from "./incomes";
import Transfers from "./transfers";

const Dashboard = () => {
  const global = useGlobalContext();
  const [page, setPage] = useState("expenses");

  if (!global.authToken) {
    return <Navigate push to="/login" />;
  }

  return (
    <div className={"dashboard-wrapper"}>
      <Toolbar setPage={setPage} />
      {page === "expenses" && <Expenses />}
      {page === "incomes" && <Incomes />}
      {page === "transfers" && <Transfers />}
    </div>
  );
};

const Toolbar = ({ setPage }) => {
  return (
    <div className={"dashboard-wrapper__toolbar"}>
      <button onClick={() => setPage("incomes")}>Incomes</button>
      <button onClick={() => setPage("expenses")}>Expenses</button>
      <button onClick={() => setPage("transfers")}>Transfers</button>
    </div>
  );
};

export default Dashboard;
