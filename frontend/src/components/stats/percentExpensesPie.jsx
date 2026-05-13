import { useState, useEffect } from "react";
import { PieChart, Tooltip, Pie, Cell, ResponsiveContainer } from "recharts";
import PieChartToolTip from "./pieChartToolTip";

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#800080",
  "#FF6347",
  "#8B0000",
  "#FFB6C1",
  "#7F00FF",
  "#4B5563",
  "#A52A2A",
  "#006400",
];

const PercentExpensesPieChart = (props) => {
  const [expensesPerCategory, setExpensesPerCategory] = useState(null);

  function getTotalExpenses() {
    return (props.expenses || []).reduce(
      (sum, e) => sum + parseFloat(e.converted_amount ?? e.amount ?? 0),
      0
    );
  }

  function getExpensesPerCategory() {
    if (!props.categories) {
      return;
    }

    const totalExpenses = getTotalExpenses();
    if (!totalExpenses) {
      setExpensesPerCategory([]);
      return;
    }

    const data = [];
    for (const c of props.categories) {
      const total = (props.expenses || [])
        .filter((e) => e.category == c.id)
        .reduce(
          (sum, e) => sum + parseFloat(e.converted_amount ?? e.amount ?? 0),
          0
        );
      if (total > 0) {
        data.push({
          name: c.category,
          value:
            parseFloat(
              parseFloat(total).toFixed(2) / parseFloat(totalExpenses)
            ) * 100,
        });
      }
    }

    setExpensesPerCategory(data);
  }

  useEffect(() => {
    getExpensesPerCategory();
  }, [props.expenses, props.categories]);

  if (!expensesPerCategory?.length) {
    return null;
  }

  return (
    <div
      className={`pie-chart chart ${props.className || ""}`}
      style={{ width: "100%", height: props.height || 310 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={expensesPerCategory}
            dataKey="value"
            cx="50%"
            cy="50%"
            outerRadius={props.outerRadius || 95}
            labelLine={false}
            label={renderCustomizedLabel}
          >
            {expensesPerCategory?.map((entry, index) => {
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              );
            })}
          </Pie>
          <Tooltip
            content={<PieChartToolTip />}
            wrapperStyle={{ border: "none" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  name,
  percent,
  index,
}) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  const percentValue = percent * 100;

  return (
    <>
      {percentValue >= 5 && (
        <text
          x={x}
          y={y}
          fill={"white"}
          textAnchor={"middle"}
          dominantBaseline="middle"
          style={{ fontWeight: "bold" }}
        >
          {`${percentValue.toFixed(2)}%`}
        </text>
      )}
    </>
  );
};

export default PercentExpensesPieChart;
