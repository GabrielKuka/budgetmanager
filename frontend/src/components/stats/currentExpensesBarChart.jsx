import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import BarChartToolTip from "./barChartTooltip";

const chartAxisTick = { fill: "var(--chart-axis)" };

const CurrentCategoryBarChart = ({
  transactions,
  categories,
  data: suppliedData,
  height = 250,
  stats,
}) => {
  const categoryData = useMemo(() => {
    if (suppliedData) return suppliedData;
    if (!categories) return [];
    return categories.map((category) => ({
      category: category.category,
      amount: (transactions || [])
        .filter((transaction) => transaction.category === category.id)
        .reduce(
          (sum, transaction) =>
            sum +
            Number(transaction.converted_amount ?? transaction.amount ?? 0),
          0
        ),
    }));
  }, [categories, suppliedData, transactions]);
  const yMaxValue = Math.max(
    0,
    ...categoryData.map((row) => Number(row.amount) || 0)
  );

  return (
    <div className={"bar-chart chart"}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          margin={{ left: 0, right: 0 }}
          data={categoryData}
          barSize={20}
        >
          <XAxis dataKey="category" tick={chartAxisTick} />
          <YAxis
            type="number"
            tickSize={2}
            domain={[0, yMaxValue]}
            tick={chartAxisTick}
          />
          <Tooltip
            content={<BarChartToolTip />}
            wrapperStyle={{ border: "none" }}
          />
          <Bar
            dataKey="amount"
            fill="var(--chart-series-1)"
            radius={[6, 6, 0, 0]}
          />
          {stats && <Legend content={<CustomLenged />} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CurrentCategoryBarChart;

const CustomLenged = () => {
  return (
    <div
      style={{
        fontSize: "13px",
        margin: "10px 0px 10px 40px",
        backgroundColor: "var(--chart-label-bg)",
        color: "var(--chart-label-text)",
        padding: "7px",
        width: "80%",
        borderRadius: "3px",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      Expenses by category for the current month
    </div>
  );
};
