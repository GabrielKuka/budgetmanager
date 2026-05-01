import { useState, useEffect } from "react";
import { Bar, BarChart, Legend, Tooltip, XAxis, YAxis } from "recharts";
import BarChartToolTip from "./barChartTooltip";

const CurrentExpensesBarChart = (props) => {
  const [yMaxValue, setYMaxValue] = useState({});
  const [expensesPerCategory, setExpensesPerCategory] = useState(null);

  function getExpensesPerCategory() {
    if (!props.categories) {
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
      data.push({
        category: c.category,
        amount: parseFloat(total).toFixed(2),
      });
    }

    setExpensesPerCategory(data);
  }

  useEffect(() => {
    getExpensesPerCategory();
  }, []);

  useEffect(() => {
    getExpensesPerCategory();
  }, [props.expenses, props.categories]);

  useEffect(() => {
    if (expensesPerCategory) {
      setYMaxValue(Math.max(...expensesPerCategory?.map((o) => o.amount)));
    }
  }, [expensesPerCategory]);

  return (
    <BarChart
      className={"bar-chart chart"}
      margin={{ left: 0, right: 0 }}
      width={props.width}
      height={props.height}
      data={expensesPerCategory}
      barSize={20}
    >
      <XAxis dataKey="category" />
      <YAxis type="number" tickSize={2} domain={[0, yMaxValue]} />
      <Tooltip
        content={<BarChartToolTip />}
        wrapperStyle={{ border: "none" }}
      />
      <Bar dataKey="amount" fill="#8884d8" />
      {props.stats && <Legend content={<CustomLenged />} />}
    </BarChart>
  );
};

export default CurrentExpensesBarChart;

const CustomLenged = () => {
  return (
    <div
      style={{
        fontSize: "13px",
        margin: "10px 0px 10px 40px",
        backgroundColor: "#D3D3D3",
        color: "black",
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
