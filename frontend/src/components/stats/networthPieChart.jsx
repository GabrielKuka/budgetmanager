import { useState, useEffect } from "react";
import currencyService from "../../services/currencyService";
import { Pie, PieChart, Cell, Label, Tooltip, Legend } from "recharts";

const NetworthPieChart = ({ accounts }) => {
  const [data, setData] = useState(null);

  const [investments, setInvestments] = useState("");
  const [bankAssets, setBankAssets] = useState("");
  const [cash, setCash] = useState("");

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
          return await currencyService.convert(a.currency, "EUR", a.amount);
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
          return await currencyService.convert(a.currency, "EUR", a.amount);
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
          return await currencyService.convert(a.currency, "EUR", a.amount);
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
    <PieChart width={470} height={310}>
      <Pie
        data={data}
        dataKey="value"
        cx="50%"
        cy="50%"
        outerRadius={100}
        label={renderCustomizedLabel}
        stroke="none"
      >
        {data?.map((entry, index) => {
          return (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          );
        })}
        <Label valueKey="value" position="outside" />
      </Pie>
      <Tooltip content={<CustomTooltip />} wrapperStyle={{ border: "none" }} />
      <Legend
        wrapperStyle={{ border: "none" }}
        layout={"vertical"}
        align="right"
        verticalAlign="bottom"
      />
    </PieChart>
  );
};

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  outerRadius,
  name,
  value,
}) => {
  const radius = outerRadius + 30;
  const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
  const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));

  return (
    <text
      x={x}
      y={y}
      fill="#000"
      textAnchor="middle"
      dominantBaseline="central"
    >
      {name}: {parseFloat(value).toFixed(2)}%
    </text>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: data.fill,
          padding: "5px",
          borderRadius: "3px",
          height: "50px",
          color: "white",
        }}
      >
        <p>
          <b>{`${data.name} : ${parseFloat(data.value).toFixed(2)}%`}</b>
        </p>
      </div>
    );
  }

  return null;
};

export default NetworthPieChart;
