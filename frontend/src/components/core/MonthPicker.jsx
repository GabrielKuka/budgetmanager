import React, { useState } from "react";
import { useGlobalContext } from "../../context/GlobalContext";
import "./MonthPicker.scss";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MonthPicker = ({ showDrafts, setShowDrafts }) => {
  const global = useGlobalContext();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);

  const applyMonth = (m, y) => {
    const from = new Date(y, m, 1);
    const to = new Date(y, m + 1, 0);
    global.setDateRange({ from, to });
  };

  const handleMonthChange = (e) => {
    const m = Number(e.target.value);
    const y = Number(
      document.querySelector(".month-picker__select--year").value
    );
    setMonth(m);
    setYear(y);
    applyMonth(m, y);
  };

  const handleYearChange = (e) => {
    const y = Number(e.target.value);
    const m = Number(document.querySelector(".month-picker__select").value);
    setYear(y);
    setMonth(m);
    applyMonth(m, y);
  };

  const handleReset = () => {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    setMonth(now.getMonth());
    setYear(now.getFullYear());
    global.setDateRange({ from, to: now });
  };

  const years = [];
  for (let y = currentYear - 7; y <= currentYear + 3; y++) {
    years.push(y);
  }

  return (
    <div className="month-picker">
      <span className="month-picker__label">Month</span>
      <select
        className="month-picker__select"
        value={month}
        onChange={handleMonthChange}
        aria-label="Select month"
      >
        {MONTHS.map((name, idx) => (
          <option key={idx} value={idx}>
            {name}
          </option>
        ))}
      </select>
      <select
        className="month-picker__select month-picker__select--year"
        value={year}
        onChange={handleYearChange}
        aria-label="Select year"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <button
        className="month-picker__reset"
        onClick={handleReset}
        title="Reset to current month"
      >
        Reset
      </button>
      {typeof showDrafts !== "undefined" && (
        <button
          className={`month-picker__draft-toggle${showDrafts ? " active" : ""}`}
          onClick={() => setShowDrafts((prev) => !prev)}
        >
          {showDrafts ? "Hide Drafts" : "Show Drafts"}
        </button>
      )}
    </div>
  );
};

export default MonthPicker;
