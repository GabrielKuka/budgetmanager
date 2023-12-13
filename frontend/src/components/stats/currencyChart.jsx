import { useState, useEffect } from "react";
import currencyService from "../../services/currencyService";
import { Pie, PieChart, Cell, Label, Tooltip, Legend } from "recharts";
import PieChartToolTip from "./pieChartToolTip";
import PieChartCustomizedLabel from "./pieChartCustomLabel";

const NetworthBasedOnCurrencyChart = ({ accounts }) => {
  const [data, setData] = useState(null);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28"];

  useEffect(() => {
    getWealthBasedOnCurrency();
  }, [accounts]);

  useEffect(() => {
    getWealthBasedOnCurrency();
  }, []);

  async function getWealthBasedOnCurrency() {
    let currencies = {};

    for (let a of accounts) {
      if (a.currency in currencies) {
        currencies[a.currency] += a.amount;
      } else {
        currencies[a.currency] = a.amount;
      }
    }

    let total = 0;
    for (let c in currencies) {
      currencies[c] = await currencyService.convert(c, "EUR", currencies[c]);
      total += parseFloat(currencies[c]);
    }

    let data = [];
    for (let c in currencies) {
      data.push({ name: c, value: (currencies[c] / total) * 100 });
    }

    setData(data);
  }

  return (
    <PieChart width={470} height={310}>
      <Pie
        data={data}
        dataKey="value"
        cx="50%"
        cy="50%"
        outerRadius={100}
        stroke="none"
        label={PieChartCustomizedLabel}
      >
        {data?.map((entry, index) => {
          return (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          );
        })}
        <Label valueKey="value" position="outside" />
      </Pie>
      <Tooltip
        content={<PieChartToolTip />}
        wrapperStyle={{ border: "none" }}
      />
      <Legend
        wrapperStyle={{ border: "none" }}
        layout={"vertical"}
        align="right"
        verticalAlign="bottom"
      />
    </PieChart>
  );
};

export default NetworthBasedOnCurrencyChart;
