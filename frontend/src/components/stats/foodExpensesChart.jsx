import { useState, useEffect } from "react";
import {
  Bar,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
  ResponsiveContainer,
  BarChart,
} from "recharts";
import { helper } from "../helper";
import { useGlobalContext } from "../../context/GlobalContext";
import statService from "../../services/transactionService/statService";

const FoodExpensesChart = (props) => {
  const global = useGlobalContext();
  const [data, setData] = useState(null);

  useEffect(() => {
    async function getFoodStats() {
      const data = await statService.getFoodStats(global.globalCurrency);
      console.log(data["data"]);
      setData(data["data"]);
    }

    getFoodStats();
  }, [global.globalCurrency]);

  return (
    <ResponsiveContainer width={props.width} height={props.height}>
      <BarChart
        data={data}
        width={props.width}
        height={props.height}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <XAxis dataKey="year_month" />
        <YAxis />
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLenged />} />
        <Bar dataKey="kaufland" stackId="a" fill="red" />
        <Bar dataKey="billa" stackId="a" fill="yellow" />
        <Bar dataKey="lidl" stackId="a" fill="blue" />
        <Bar dataKey="others" stackId="a" fill="#82ca9d" />
      </BarChart>
    </ResponsiveContainer>
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
      Food Expenses Every Month
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
        Total:{" "}
        <b>
          {`${helper.showOrMask(
            global.privacyMode,
            parseFloat(data.total_amount).toFixed(2)
          )}`}{" "}
          {helper.getCurrency(global.globalCurrency)}
        </b>
        <br />
        Kaufland:{" "}
        <b>
          {`${helper.showOrMask(
            global.privacyMode,
            parseFloat(data.kaufland).toFixed(2)
          )}`}{" "}
          {helper.getCurrency(global.globalCurrency)}{" "}
        </b>
        <br />
        Billa:{" "}
        <b>
          {`${helper.showOrMask(
            global.privacyMode,
            parseFloat(data.billa).toFixed(2)
          )}`}{" "}
          {helper.getCurrency(global.globalCurrency)}{" "}
        </b>
        <br />
        Lidl:{" "}
        <b>
          {`${helper.showOrMask(
            global.privacyMode,
            parseFloat(data.lidl).toFixed(2)
          )}`}{" "}
          {helper.getCurrency(global.globalCurrency)}{" "}
        </b>
        <br />
        Others:{" "}
        <b>
          {`${helper.showOrMask(
            global.privacyMode,
            parseFloat(data.others).toFixed(2)
          )}`}{" "}
          {helper.getCurrency(global.globalCurrency)}{" "}
        </b>
      </div>
    );
  }

  return null;
};

export default FoodExpensesChart;
