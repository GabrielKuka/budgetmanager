import { useState, useEffect } from "react";
import currencyService from "../../services/currencyService";
import {
  AreaChart,
  CartesianGrid,
  Legend,
  Area,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const IncomeVsExpenseChart = (props) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function arrangeData() {
      const items = [];

      const today = new Date();
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setFullYear(today.getFullYear() - 1);

      async function getExpensesYoY() {
        let expensesByMonth = {};
        for (const e of props.expenses) {
          const date = new Date(e.date);
          if (date > twelveMonthsAgo) {
            const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1)
              .toString()
              .padStart(2, "0")}`;

            if (!expensesByMonth[monthYear]) {
              expensesByMonth[monthYear] = 0;
            }

            let amount = await currencyService.convert(
              props.getAccountCurrency(e.account),
              "EUR",
              e.amount
            );
            expensesByMonth[monthYear] += Number(amount) || 0;
          }
        }
        return expensesByMonth;
      }

      async function getIncomesYoY() {
        let incomesByMonth = {};
        for (const i of props.incomes) {
          const date = new Date(i.date);

          if (date > twelveMonthsAgo) {
            const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1)
              .toString()
              .padStart(2, "0")}`;
            if (!incomesByMonth[monthYear]) {
              incomesByMonth[monthYear] = 0;
            }

            const amount = await currencyService.convert(
              props.getAccountCurrency(i.account),
              "EUR",
              i.amount
            );

            incomesByMonth[monthYear] += Number(amount) || 0;
          }
        }
        return incomesByMonth;
      }

      const expensesByMonth = await getExpensesYoY();
      const incomesByMonth = await getIncomesYoY();

      for (let monthYear in expensesByMonth) {
        items.push({
          date: monthYear,
          income: parseFloat(incomesByMonth[monthYear]).toFixed(2),
          expense: parseFloat(expensesByMonth[monthYear]).toFixed(2),
        });
      }
      setData(items);
    }

    arrangeData();
  }, [props.expenses, props.incomes]);

  return (
    <AreaChart
      width={props.width}
      height={props.height}
      data={data}
      margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
    >
      <defs>
        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#00FF00" stopOpacity={0.8} />
          <stop offset="95%" stopColor="#00FF00" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#DC143C" stopOpacity={0.8} />
          <stop offset="95%" stopColor="#DC143C" stopOpacity={0} />
        </linearGradient>
      </defs>

      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip content={<AreaChartChartToolTip />} />
      <Legend />
      <Area
        type="monotone"
        dataKey="income"
        stroke="#00FF00"
        fillOpacity={1}
        fill="url(#colorIncome)"
      />
      <Area
        type="monotone"
        dataKey="expense"
        stroke="#DC143C"
        fillOpacity={1}
        fill="url(#colorExpense)"
      />
    </AreaChart>
  );
};

const AreaChartChartToolTip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: "cadetblue",
          padding: "5px",
          borderRadius: "3px",
          height: "50px",
          color: "white",
          height: "fit-content",
        }}
      >
        {`${data.date}`}
        <br />
        Earned: <b>{`${data.income}`} €</b>
        <br />
        Spent: <b>{`${data.expense}`} €</b>
        <br />
        Saved: <b>{parseFloat(data.income - data.expense).toFixed(2)} €</b>
      </div>
    );
  }

  return null;
};

export default IncomeVsExpenseChart;
