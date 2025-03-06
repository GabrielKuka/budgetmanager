import { useState, useEffect } from "react";
import currencyService from "../../services/currencyService";
import { Pie, PieChart, Cell, Label, Tooltip, Legend } from "recharts";
import PieChartToolTip from "./pieChartToolTip";
import PieChartCustomizedLabel from "./pieChartCustomLabel";
import { useGlobalContext } from "../../context/GlobalContext";

const WealthByAccounts = ({ accounts }) => {
  const [data, setData] = useState(null);
  const global = useGlobalContext();
  const [activeIndex, setActiveIndex] = useState(null);

  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF0000",
    "#00BCD4",
    "#FF9800",
    "#3F51B5",
    "#8BC34A",
  ];

  useEffect(() => {
    getAmountPerAccount();
  }, []);

  async function getAmountPerAccount() {
    let amountPerAccount = { Cash: 0 };

    let total = 0;
    for (let a of accounts) {
      const account_name = a.type == 2 ? "Cash" : a.name;
      if (a.type == 2) {
        amountPerAccount[account_name] += parseFloat(
          await currencyService.convert(
            a.currency,
            global.globalCurrency,
            a.amount
          )
        );
      } else {
        amountPerAccount[account_name] = await currencyService.convert(
          a.currency,
          global.globalCurrency,
          a.amount
        );
      }
      total += parseFloat(amountPerAccount[account_name]);
    }

    let data = [];
    for (let i in amountPerAccount) {
      data.push({ name: i, value: (amountPerAccount[i] / total) * 100 });
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
        cx="55%"
        cy="50%"
        outerRadius={100}
        innerRadius={40}
        stroke="none"
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

export default WealthByAccounts;
