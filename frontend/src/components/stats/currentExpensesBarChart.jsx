import { useState, useEffect } from "react";
import currencyService from "../../services/currencyService";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";

const CurrentExpensesBarChart = (props) => {
  const [yMaxValue, setYMaxValue] = useState({});
  const [expensesPerCategory, setExpensesPerCategory] = useState(null);

  async function getExpensesPerCategory() {
    if (!props.categories) {
      return;
    }
    console.log(props.categories);
    const data = [];
    for (const c of props.categories) {
      let promises = props.expenses
        ?.filter((e) => e.expense_category == c.id)
        ?.map(async (e) => {
          return await currencyService.convert(
            props.getAccountCurrency(e.account),
            "EUR",
            e.amount
          );
        });
      console.log(props.expenses);
      const results = await Promise.all(promises);
      const total = results.reduce((t, curr) => (t += parseFloat(curr)), 0);
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
    </BarChart>
  );
};

export default CurrentExpensesBarChart;

const BarChartToolTip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: "cadetBlue",
          padding: "5px",
          borderRadius: "3px",
          height: "50px",
          color: "white",
        }}
      >
        <p>
          <b>{`${data.category} : ${parseFloat(data.amount).toFixed(2)} €`}</b>
        </p>
      </div>
    );
  }

  return null;
};
