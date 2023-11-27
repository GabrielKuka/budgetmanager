import { useState, useEffect } from "react";
import { Cell, Pie, Legend, PieChart, Label, Tooltip } from "recharts";
import transactionService from "../../services/transactionService/transactionService";
import currencyService from "../../services/currencyService";

import "./stats.scss";

const Stats = (props) => {
  const [accounts, setAccounts] = useState([]);
  const [totalNetworthData, setTotalNetworthData] = useState(null);

  useEffect(() => {
    getAccounts();
    getTotalNetworthData();
  }, []);

  async function getAccounts() {
    const accounts = await transactionService.getAllUserAccounts();
    setAccounts(accounts);
  }

  async function getTotalNetworthData() {
    let bankAssets = "";
    let cash = "";
    let investments = "";
    let networth = "";

    let promises = accounts?.map(async (a) => {
      if (a.type == 1) {
        return await currencyService.convert(a.currency, "EUR", a.amount);
      }
      return 0;
    });

    let results = await Promise.all(promises);
    investments = results.reduce((acc, curr) => acc + parseFloat(curr), 0);

    promises = accounts?.map(async (a) => {
      if (a.type == 2) {
        return await currencyService.convert(a.currency, "EUR", a.amount);
      }
      return 0;
    });

    results = await Promise.all(promises);
    cash = results.reduce((acc, curr) => acc + parseFloat(curr), 0);

    promises = accounts?.map(async (a) => {
      if (a.type == 0) {
        return await currencyService.convert(a.currency, "EUR", a.amount);
      }
      return 0;
    });

    results = await Promise.all(promises);
    bankAssets = results.reduce((acc, curr) => acc + parseFloat(curr), 0);

    networth = parseFloat(bankAssets + investments + cash).toFixed(2);

    const data = [
      {
        name: "Investments",
        value: parseFloat((investments / networth) * 100),
      },
      { name: "Paper Cash", value: parseFloat((cash / networth) * 100) },
      {
        name: "Bank Assets",
        value: parseFloat((bankAssets / networth) * 100),
      },
    ];
    console.log(data);

    setTotalNetworthData(data);
  }

  return (
    <div className={"stats-wrapper"}>
      <div>
        <NetworthPieChart data={totalNetworthData} />
      </div>
      <div>Item 2</div>
      <div>Item 3</div>
      <div>Item 4</div>
    </div>
  );
};

const NetworthPieChart = (props) => {
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28"];

  return (
    <PieChart width={470} height={310}>
      <Pie
        data={props.data}
        dataKey="value"
        cx="50%"
        cy="50%"
        outerRadius={100}
        fill="#8884d8"
        label={renderCustomizedLabel}
      >
        {props.data?.map((entry, index) => {
          return (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          );
        })}
        <Label valueKey="value" position="outside" />
      </Pie>
      <Tooltip content={<CustomTooltip />} wrapperStyle={{ border: "none" }} />
      <Legend
        content={<CustomLenged />}
        layout={"vertical"}
        align="right"
        verticalAlign="bottom"
      />
    </PieChart>
  );
};

const CustomLenged = ({ payload }) => {
  return (
    <ul>
      {payload.map((entry, index) => (
        <li key={`item-${index}`}>
          <span style={{ color: entry.color }}>{entry.value}</span>:{" "}
          {entry.payload.percent}
        </li>
      ))}
    </ul>
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

export default Stats;
