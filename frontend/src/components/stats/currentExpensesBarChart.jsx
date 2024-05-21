import { useState, useEffect } from "react";
import currencyService from "../../services/currencyService";
import { Bar, BarChart, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { useGlobalContext } from "../../context/GlobalContext";
import { helper } from "../helper";

const CurrentExpensesBarChart = (props) => {
  const global = useGlobalContext();
  const [yMaxValue, setYMaxValue] = useState({});
  const [expensesPerCategory, setExpensesPerCategory] = useState(null);

  async function getExpensesPerCategory() {
    if (!props.categories) {
      return;
    }
    const data = [];
    for (const c of props.categories) {
      let promises = props.expenses
        ?.filter((e) => e.expense_category == c.id)
        ?.map(async (e) => {
          return await currencyService.convert(
            props.getAccountCurrency(e.account),
            global.globalCurrency,
            e.amount
          );
        });
      const results = await Promise.all(promises);
      const total = results.reduce((t, curr) => (t += parseFloat(curr)), 0);
      data.push({
        category: c.category,
        amount: parseFloat(total).toFixed(2),
      });
    }

    setExpensesPerCategory(data);
  }

  useEffect(() => {
    getExpensesPerCategory();
  }, []);

  useEffect(() => {
    getExpensesPerCategory();
  }, [props.expenses, props.categories, global.globalCurrency]);

  useEffect(() => {
    if (expensesPerCategory) {
      setYMaxValue(Math.max(...expensesPerCategory?.map((o) => o.amount)));
    }
  }, [expensesPerCategory]);

  return (
    <BarChart
      className={"bar-chart chart"}
      margin={{ left: 0, right: 0 }}
      width={props.width}
      height={props.height}
      data={expensesPerCategory}
      barSize={20}
    >
      <XAxis dataKey="category" />
      <YAxis type="number" tickSize={2} domain={[0, yMaxValue]} />
      <Tooltip
        content={<BarChartToolTip />}
        wrapperStyle={{ border: "none" }}
      />
      <Bar dataKey="amount" fill="#8884d8" />
      {props.stats && <Legend content={<CustomLenged />} />}
    </BarChart>
  );
};

export default CurrentExpensesBarChart;

const BarChartToolTip = ({ active, payload }) => {
  const global = useGlobalContext();
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: "cadetBlue",
          padding: "5px",
          borderRadius: "3px",
          height: "50px",
          color: "white",
        }}
      >
        <p>
          <b>{`${data.category} : ${helper.showOrMask(
            global.privacyMode,
            parseFloat(data.amount).toFixed(2)
          )}${helper.getCurrency(global.globalCurrency)}`}</b>
        </p>
      </div>
    );
  }

  return null;
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
        width: "80%",
        borderRadius: "3px",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      Expenses by category for the current month
    </div>
  );
};
