import { useState, useEffect } from "react";
import currencyService from "../../services/currencyService";
import { Pie, PieChart, Cell, Label, Tooltip, Legend } from "recharts";
import PieChartToolTip from "./pieChartToolTip";
import PieChartCustomizedLabel from "./pieChartCustomLabel";
import { useGlobalContext } from "../../context/GlobalContext";

const NetworthPieChart = ({ accounts }) => {
  const [data, setData] = useState(null);
  const global = useGlobalContext();

  const [investments, setInvestments] = useState("");
  const [bankAssets, setBankAssets] = useState("");
  const [cash, setCash] = useState("");
  const [activeIndex, setActiveIndex] = useState(null);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28"];

  useEffect(() => {
    if (investments != "" && bankAssets != "" && cash != "") {
      const c = parseFloat(cash);
      const b = parseFloat(bankAssets);
      const i = parseFloat(investments);

      let total = parseFloat(b + i + c).toFixed(2);

      const result = [
        {
          name: "Investments",
          value: parseFloat((investments / total) * 100),
        },
        { name: "Paper Cash", value: parseFloat((cash / total) * 100) },
        {
          name: "Bank Assets",
          value: parseFloat((bankAssets / total) * 100),
        },
      ];

      setData(result);
    }
  }, [investments, cash, bankAssets]);

  useEffect(() => {
    getTotalNetworthData();
  }, [accounts]);

  async function getTotalNetworthData() {
    async function convertInvestments() {
      let promises = accounts.map(async (a) => {
        if (a.type == 1) {
          return await currencyService.convert(
            a.currency,
            global.globalCurrency,
            a.amount
          );
        }
        return 0;
      });

      let results = await Promise.all(promises);
      let total = results.reduce((acc, curr) => acc + parseFloat(curr), 0);
      setInvestments(total.toFixed(2));
    }
    async function convertCash() {
      let promises = accounts.map(async (a) => {
        if (a.type == 2) {
          return await currencyService.convert(
            a.currency,
            global.globalCurrency,
            a.amount
          );
        }
        return 0;
      });

      let results = await Promise.all(promises);
      let total = results.reduce((acc, curr) => acc + parseFloat(curr), 0);
      setCash(total.toFixed(2));
    }
    async function convertBankAssets() {
      let promises = accounts.map(async (a) => {
        if (a.type == 0) {
          return await currencyService.convert(
            a.currency,
            global.globalCurrency,
            a.amount
          );
        }
        return 0;
      });

      let results = await Promise.all(promises);
      let total = results.reduce((acc, curr) => acc + parseFloat(curr), 0);
      setBankAssets(total.toFixed(2));
    }

    convertInvestments();
    convertCash();
    convertBankAssets();
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
        cx="65%"
        cy="40%"
        outerRadius={80}
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

export default NetworthPieChart;
