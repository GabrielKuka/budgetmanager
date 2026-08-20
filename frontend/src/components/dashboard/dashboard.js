import React, { forwardRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalContext } from "../../context/GlobalContext";
import { Navigate } from "react-router-dom";
import "./dashboard.scss";
import Expenses from "./expenses";
import Incomes from "./incomes";
import Transfers from "./transfers";
import DatePicker from "react-datepicker";
import {
  SegmentedControl,
  WorkspaceHero,
  WorkspaceShell,
} from "../core/workspace";
import "./cashFlowWorkspace.scss";

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
  }, [page, navigate]);

  if (!global.authToken) {
    return <Navigate push to="/login" />;
  }

  return (
    <WorkspaceShell className="dashboard-wrapper">
      <WorkspaceHero
        eyebrow="Cash flow workspace"
        title="Dashboard"
        description="Understand where money moves and manage every transaction from one place."
        actions={<Sidebar setPage={setPage} page={page} />}
      />
      {page === "expenses" && <Expenses />}
      {page === "incomes" && <Incomes />}
      {page === "transfers" && <Transfers />}
    </WorkspaceShell>
  );
};

const Sidebar = ({ page, setPage }) => {
  const buttons = ["incomes", "expenses", "transfers"];
  const global = useGlobalContext();

  function handlePage(selected) {
    setPage(selected);
  }
  return (
    <div className={"dashboard-wrapper__sidebar"}>
      <SegmentedControl
        className="dashboard-tabs"
        label="Cash flow views"
        value={page}
        onChange={handlePage}
        options={buttons.map((item) => ({
          value: item,
          label: item[0].toUpperCase() + item.slice(1),
        }))}
      />
      <div className="dashboard-date-controls">
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
          customInput={<DateControl label="From" />}
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
          customInput={<DateControl label="To" />}
          withPortal
        />
      </div>
    </div>
  );
};

const DateControl = forwardRef(({ label, value, onClick }, ref) => (
  <button
    type="button"
    className="dashboard-date-button"
    ref={ref}
    onClick={onClick}
  >
    <span>{label}</span>
    <b>{value}</b>
  </button>
));

export default Dashboard;
