import React, { useEffect, useState } from "react";
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

const MonthPicker = ({
  showDrafts,
  setShowDrafts,
  searchTerm,
  setSearchTerm,
}) => {
  const global = useGlobalContext();

  const now = new Date();

  const [month, setMonth] = useState(
    () => global.dateRange?.from?.getMonth() ?? now.getMonth()
  );
  const [year, setYear] = useState(
    () => global.dateRange?.from?.getFullYear() ?? now.getFullYear()
  );

  useEffect(() => {
    const from = global.dateRange?.from;
    if (from) {
      setMonth(from.getMonth());
      setYear(from.getFullYear());
    }
  }, [global.dateRange?.from]);

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
  for (let y = now.getFullYear() - 7; y <= now.getFullYear() + 3; y++) {
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
      {typeof searchTerm !== "undefined" &&
        typeof setSearchTerm !== "undefined" && (
          <input
            type="text"
            className="month-picker__search"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search transactions"
          />
        )}
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
