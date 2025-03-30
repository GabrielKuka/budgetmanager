import { useState, useEffect } from "react";
import currencyService from "../../services/currencyService";
import { PieChart, Tooltip, Pie, Cell } from "recharts";
import { useGlobalContext } from "../../context/GlobalContext";
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
  "#000000",
  "#A52A2A",
  "#006400",
];

const PercentExpensesPieChart = (props) => {
  const global = useGlobalContext();
  const [expensesPerCategory, setExpensesPerCategory] = useState(null);
  async function getTotalExpenses() {
    let totalExpenses = 0;
    for (const e of props.expenses) {
      const convertedAmount = await currencyService.convert(
        await props.getAccountCurrency(e.from_account),
        global.globalCurrency,
        e.amount
      );
      totalExpenses += parseFloat(convertedAmount);
    }

    return totalExpenses;
  }

  async function getExpensesPerCategory() {
    if (!props.categories) {
      return;
    }

    const totalExpenses = await getTotalExpenses();

    const data = [];
    for (const c of props.categories) {
      let promises = props.expenses
        ?.filter((e) => e.category == c.id)
        ?.map(async (e) => {
          return await currencyService.convert(
            props.getAccountCurrency(e.from_account),
            global.globalCurrency,
            e.amount
          );
        });
      const results = await Promise.all(promises);
      const total = results.reduce((t, curr) => (t += parseFloat(curr)), 0);
      data.push({
        name: c.category,
        value:
          parseFloat(parseFloat(total).toFixed(2) / parseFloat(totalExpenses)) *
          100,
      });
    }

    setExpensesPerCategory(data);
  }

  useEffect(() => {
    getExpensesPerCategory();
  }, []);

  return (
    <PieChart width={460} height={310} className={"chart"}>
      <Pie
        data={expensesPerCategory}
        dataKey="value"
        cx="50%"
        cy="50%"
        labelLine={false}
        label={renderCustomizedLabel}
      >
        {expensesPerCategory?.map((entry, index) => {
          return (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          );
        })}
      </Pie>
      <Tooltip
        content={<PieChartToolTip />}
        wrapperStyle={{ border: "none" }}
      />
    </PieChart>
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

  const adjustedValue = parseFloat(percent).toFixed(2);

  return (
    <>
      {parseFloat(percent).toFixed(2) * 100 > 1 && (
        <text
          x={x}
          y={y}
          fill={"white"}
          textAnchor={"middle"}
          dominantBaseline="middle"
          style={{ fontWeight: "bold" }}
        >
          {`${adjustedValue * 100 >= 10 ? name : ""} ${parseFloat(
            adjustedValue * 100
          ).toFixed(2)}%`}
        </text>
      )}
    </>
  );
};

export default PercentExpensesPieChart;
