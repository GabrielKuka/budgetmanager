import { useState, useEffect } from "react";
import { Cell, Pie, Legend, PieChart, Label, Tooltip } from "recharts";
import transactionService from "../../services/transactionService/transactionService";
import currencyService from "../../services/currencyService";
import NetworthPieChart from "./networthPieChart";

import "./stats.scss";

const Stats = (props) => {
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    getAccounts();
  }, []);

  async function getAccounts() {
    const accounts = await transactionService.getAllUserAccounts();
    setAccounts(accounts);
  }

  return (
    <div className={"stats-wrapper"}>
      <div>
        <NetworthPieChart accounts={accounts} />
      </div>
      <div>Item 2</div>
      <div>Item 3</div>
      <div>Item 4</div>
    </div>
  );
};

export default Stats;
