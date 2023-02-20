import React, { useState, useEffect } from "react";
import { useGlobalContext } from "../../context/GlobalContext";
import { Navigate } from "react-router-dom";
import "./dashboard.scss";

const Dashboard = () => {
  const global = useGlobalContext();
  const [page, setPage] = useState("expenses");

  useEffect(() => {
    console.log(page);
  }, [page]);

  if (!global.authToken) {
    return <Navigate push to="/login" />;
  }

  return (
    <div className={"dashboard-wrapper"}>
      <Toolbar setPage={setPage} />
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
