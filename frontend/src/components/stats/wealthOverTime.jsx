import { useEffect, useState } from "react";
import { useGlobalContext } from "../../context/GlobalContext";
import { helper } from "../helper";
import currencyService from "../../services/currencyService";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const WealthOverTime = (props) => {
  const global = useGlobalContext();
  const [data, setData] = useState(null);

  useEffect(() => {
    async function arrangeData() {
      const items = [];

      const today = new Date();

      async function getTotalWealth() {
        let promises = global.activeAccounts.map(async (a) => {
          return await currencyService.convert(
            a.currency,
            global.globalCurrency,
            a.amount
          );
        });

        let results = await Promise.all(promises);
        let total = results.reduce((acc, curr) => acc + parseFloat(curr), 0);

        return total;
      }

      async function getExpensesYoY() {
        let expensesByMonth = {};
        for (const e of props.expenses) {
          const date = new Date(e.date);
          const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1)
            .toString()
            .padStart(2, "0")}`;

          if (!expensesByMonth[monthYear]) {
            expensesByMonth[monthYear] = 0;
          }

          let amount = await currencyService.convert(
            props.getAccountCurrency(e.account),
            global.globalCurrency,
            e.amount
          );
          expensesByMonth[monthYear] += Number(amount) || 0;
        }
        return expensesByMonth;
      }

      async function getIncomesYoY() {
        let incomesByMonth = {};
        for (const i of props.incomes) {
          const date = new Date(i.date);

          const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1)
            .toString()
            .padStart(2, "0")}`;
          if (!incomesByMonth[monthYear]) {
            incomesByMonth[monthYear] = 0;
          }

          const amount = await currencyService.convert(
            props.getAccountCurrency(i.account),
            global.globalCurrency,
            i.amount
          );

          incomesByMonth[monthYear] += Number(amount) || 0;
        }
        return incomesByMonth;
      }

      let expensesByMonth = await getExpensesYoY();
      let incomesByMonth = await getIncomesYoY();
      const totalWealth = await getTotalWealth();

      // Convert to array and sort by date
      const sortedEntries = Object.entries(expensesByMonth).sort(
        ([date1], [date2]) => new Date(date2) - new Date(date1)
      );

      // Convert back to a Map
      const sortedMap = new Map(sortedEntries);
      let currentWealth = totalWealth;

      const currentMonthYear = `${new Date().getFullYear()}-${(
        new Date().getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}`;

      sortedMap.forEach((currentExpense, monthYear) => {
        if (monthYear === currentMonthYear) {
          items.push({
            date: monthYear,
            monthlyWealth: totalWealth,
          });
          return;
        }
        if (
          typeof incomesByMonth[monthYear] === "undefined" ||
          expensesByMonth[monthYear] === "undefined"
        ) {
          return;
        }
        const currentIncome = parseFloat(incomesByMonth[monthYear].toFixed(2));
        const netChange = parseFloat(
          (currentIncome - currentExpense).toFixed(2)
        );
        currentWealth = parseFloat((currentWealth - netChange).toFixed(2));

        items.push({
          date: monthYear,
          monthlyWealth: currentWealth,
        });
      });

      setData(items);
    }

    arrangeData();
  }, [props.expenses, props.incomes, global.globalCurrency]);

  return (
    <AreaChart
      width={props.width}
      height={props.height}
      data={data?.sort((a, b) => new Date(a.date) - new Date(b.date))}
      margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
    >
      <defs>
        <linearGradient id="colorLine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#5F9EA0" stopOpacity={0.8} />{" "}
          <stop offset="50%" stopColor="#7FB5B5" stopOpacity={0.5} />{" "}
          <stop offset="95%" stopColor="#2F4F4F" stopOpacity={0} />{" "}
        </linearGradient>
      </defs>

      <CartesianGrid strokeDasharray="6 6" />
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip content={<AreaChartChartToolTip />} />
      <Area
        type="monotone"
        dataKey="monthlyWealth"
        stroke="cadetblue"
        fillOpacity={1}
        fill="url(#colorLine)"
      />
      <Legend content={<CustomLegend />} />
    </AreaChart>
  );
};

const AreaChartChartToolTip = ({ active, payload }) => {
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
        {`${data.date}`}
        <br />
        Total:{" "}
        <b>
          {helper.showOrMask(
            global.privacyMode,
            helper.formatNumber(parseFloat(data.monthlyWealth).toFixed(2))
          )}{" "}
          {helper.getCurrency(global.globalCurrency)}
        </b>
      </div>
    );
  }

  return null;
};

const CustomLegend = () => {
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
      Total wealth over time.
    </div>
  );
};

export default WealthOverTime;
