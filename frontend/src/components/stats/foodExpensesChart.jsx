import { useState, useEffect } from "react";
import currencyService from "../../services/currencyService";
import {
  Line,
  LineChart,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { helper } from "../helper";
import { useGlobalContext } from "../../context/GlobalContext";

const FoodExpensesChart = (props) => {
  const global = useGlobalContext();
  const [data, setData] = useState(null);

  useEffect(() => {
    async function getData() {
      const items = [];
      const today = new Date();
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setFullYear(today.getFullYear() - 1);

      // Get Total Income for each month
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

      // Get food expenses for each month
      let foodExpensesByMonth = {};
      for (const e of props.expenses) {
        const date = new Date(e.date);
        if (date > twelveMonthsAgo) {
          const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1)
            .toString()
            .padStart(2, "0")}`;

          if (!foodExpensesByMonth[monthYear]) {
            foodExpensesByMonth[monthYear] = 0;
          }

          let amount = await currencyService.convert(
            props.getAccountCurrency(e.account),
            "EUR",
            e.amount
          );
          foodExpensesByMonth[monthYear] += Number(amount) || 0;
        }
      }
      // Calculate the ratio
      for (const date in foodExpensesByMonth) {
        if (incomesByMonth[date] < foodExpensesByMonth[date]) {
          continue;
        }
        items.push({
          date: date,
          ratio: parseFloat(
            (foodExpensesByMonth[date] / incomesByMonth[date]) * 100
          ),
          income: incomesByMonth[date],
          food: foodExpensesByMonth[date],
        });
      }
      setData(items);
    }

    getData();
  }, [props.expenses, props.income]);

  return (
    <LineChart
      width={props.width}
      height={props.height}
      data={data}
      margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
    >
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip content={<CustomTooltip />} />
      <Legend content={<CustomLenged />} />
      <Line type="monotone" dataKey="ratio" stroke="#8884d8" />
    </LineChart>
  );
};

const CustomLenged = () => {
  return (
    <div
      style={{
        fontSize: "13px",
        margin: "10px 0px 10px 40px",
        backgroundColor: "#D3D3D3",
        color: "black",
        padding: "7px",
        width: "90%",
        borderRadius: "3px",
        cursor: "pointer",
      }}
    >
      This chart shows food expenses compared to income monthly.
    </div>
  );
};

const CustomTooltip = ({ active, payload }) => {
  const global = useGlobalContext();
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
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
        Income:{" "}
        <b>
          {`${helper.showOrMask(
            global.privacyMode,
            parseFloat(data.income).toFixed(2)
          )}`}{" "}
          €
        </b>
        <br />
        Food:{" "}
        <b>
          {`${helper.showOrMask(
            global.privacyMode,
            parseFloat(data.food).toFixed(2)
          )}`}{" "}
          €{" "}
        </b>
        <br />
        Ratio: <b>{`${parseFloat(data.ratio).toFixed(2)}`} %</b>
      </div>
    );
  }

  return null;
};

export default FoodExpensesChart;
