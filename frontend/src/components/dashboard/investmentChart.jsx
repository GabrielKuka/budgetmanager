import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import accountService from "../../services/transactionService/accountService";
import { helper } from "../helper";
import { useGlobalContext } from "../../context/GlobalContext";
import "./investmentChart.scss";

const TIMEFRAMES = ["1D", "5D", "MTD", "YTD", "1Y", "5Y", "MAX"];

const InvestmentChart = () => {
  const global = useGlobalContext();
  const targetCur = global.globalCurrency || "EUR";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("1Y");
  const [mode, setMode] = useState("value"); // "value" | "change"

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await accountService.getPortfolioHistory(
        timeframe,
        targetCur,
      );
      setData(result || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [timeframe, targetCur]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartData = data || [];

  // Compute first value for % change
  const firstValue = chartData.length > 0 ? chartData[0].total : 0;

  const formatYAxis = (val) => {
    if (mode === "change") return `${val.toFixed(1)}%`;
    return `${helper.formatNumber(val)} ${helper.getCurrency(targetCur)}`;
  };

  const formatTooltipValue = (val, _name) => {
    if (mode === "change") return `${val.toFixed(2)}%`;
    return `${helper.formatNumber(val)} ${helper.getCurrency(targetCur)}`;
  };

  return (
    <div className="investment-chart">
      <div className="investment-chart__header">
        <span className="investment-chart__title">Investment Value</span>
        <div className="investment-chart__controls">
          <div className="investment-chart__timeframes">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                className={`investment-chart__btn${
                  timeframe === tf ? " active" : ""
                }`}
                onClick={() => setTimeframe(tf)}
              >
                {tf}
              </button>
            ))}
          </div>
          <div className="investment-chart__mode-toggle">
            <button
              className={`investment-chart__btn${
                mode === "value" ? " active" : ""
              }`}
              onClick={() => setMode("value")}
            >
              Value
            </button>
            <button
              className={`investment-chart__btn${
                mode === "change" ? " active" : ""
              }`}
              onClick={() => setMode("change")}
            >
              % Change
            </button>
          </div>
        </div>
      </div>

      <div className="investment-chart__body">
        {loading ? (
          <div className="investment-chart__loading">
            <img
              src={`${process.env.PUBLIC_URL}/loading_icon.gif`}
              alt="loading"
              width={40}
              height={40}
            />
          </div>
        ) : chartData.length === 0 ? (
          <div className="investment-chart__empty">
            <span>No investment data available for this period.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={chartData.map((pt) => ({
                ...pt,
                displayValue: mode === "change" ? pt.change_pct : pt.total,
              }))}
              margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--muted-text)" }}
                tickFormatter={(d) => {
                  const parts = d.split("-");
                  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
                }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-text)" }}
                tickFormatter={formatYAxis}
                domain={mode === "change" ? ["auto", "auto"] : [0, "auto"]}
              />
              <Tooltip
                formatter={(value) => [formatTooltipValue(value, null)]}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{
                  backgroundColor: "var(--surface-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 3,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey={mode === "change" ? "change_pct" : "total"}
                stroke="var(--brand)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default InvestmentChart;
