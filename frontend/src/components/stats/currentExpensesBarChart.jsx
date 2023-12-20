import { useState, useEffect } from "react";
import currencyService from "../../services/currencyService";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";

const CurrentExpensesBarChart = (props) => {
  const [totalShownExpenses, setTotalShownExpenses] = useState(0);
  const [yMaxValue, setYMaxValue] = useState({});
  const [expensesPerCategory, setExpensesPerCategory] = useState("");

  useEffect(() => {
    async function getTotal() {
      let promises = props.expenses.map(async (e) => {
        return await currencyService.convert(
          props.getAccountCurrency(e.account),
          "EUR",
          e.amount
        );
      });

      const results = await Promise.all(promises);
      let total = results.reduce((acc, curr) => acc + parseFloat(curr), 0);

      setTotalShownExpenses(parseFloat(total).toFixed(2));
    }

    async function getExpensesPerCategory() {
      const data = [];
      for (const c of props.categories) {
        let promises = props.expenses
          .filter((e) => e.expense_category == c.id)
          .map(async (e) => {
            return await currencyService.convert(
              props.getAccountCurrency(e.account),
              "EUR",
              e.amount
            );
          });

        const results = await Promise.all(promises);
        const total = results.reduce((t, curr) => (t += parseFloat(curr)), 0);
        data.push({
          category: c.category_type,
          amount: parseFloat(total).toFixed(2),
        });
      }

      setExpensesPerCategory(data);
    }

    getExpensesPerCategory();
    getTotal();
  }, [props.expenses]);

  useEffect(() => {
    if (expensesPerCategory) {
      setYMaxValue(Math.max(...expensesPerCategory.map((o) => o.amount)));
    }
  }, [expensesPerCategory]);

  return (
    <BarChart
      className={"bar-chart"}
      margin={{ left: 0, right: 0 }}
      width={props.width}
      height={props.height}
      data={expensesPerCategory}
      barSize={20}
    >
      <XAxis dataKey="category" />
      <YAxis type="number" tickSize={2} domain={[0, yMaxValue]} />
      <Tooltip />
      <Bar dataKey="amount" fill="#8884d8" />
    </BarChart>
  );
};

export default CurrentExpensesBarChart;

// width: 330 height: 250
