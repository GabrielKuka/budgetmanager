import { useState, useEffect } from "react";
import currencyService from "../../services/currencyService";
import { Pie, PieChart, Cell, Label, Tooltip, Legend } from "recharts";
import PieChartToolTip from "./pieChartToolTip";
import PieChartCustomizedLabel from "./pieChartCustomLabel";
import { useGlobalContext } from "../../context/GlobalContext";

const NetworthBasedOnCurrencyChart = ({ accounts }) => {
  const [data, setData] = useState(null);
  const global = useGlobalContext();
  const [activeIndex, setActiveIndex] = useState(null);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF0000"];

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
      currencies[c] = await currencyService.convert(
        c,
        global.globalCurrency,
        currencies[c]
      );
      total += parseFloat(currencies[c]);
    }

    let data = [];
    for (let c in currencies) {
      data.push({ name: c, value: (currencies[c] / total) * 100 });
    }

    setData(data);
  }

  return (
    <PieChart width={450} height={280} className={"chart"}>
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="1" dy="1" stdDeviation="4" floodOpacity="0.3" />
        </filter>
      </defs>
      <Pie
        data={data}
        dataKey="value"
        cx="50%"
        cy="50%"
        outerRadius={100}
        innerRadius={40}
        stroke="none"
        label={PieChartCustomizedLabel}
        filter="url(#shadow)"
        onMouseEnter={(_, index) => setActiveIndex(index)}
        onMouseLeave={() => setActiveIndex(null)}
      >
        {data?.map((entry, index) => {
          return (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
              style={{
                transform: activeIndex === index ? "scale(1.2)" : "scale(1)",
                transformOrigin: "center",
              }}
            />
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
