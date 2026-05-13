import {
  AreaChart,
  CartesianGrid,
  Legend,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useGlobalContext } from "../../context/GlobalContext";
import { helper } from "../helper";

const chartAxisTick = { fill: "var(--chart-axis)" };

const IncomeVsExpenseChart = (props) => {
  const data = props.data || [];
  const currentMonth = new Date().toISOString().slice(0, 7);
  const filteredData = data.filter((item) => {
    if (item.date !== currentMonth) {
      return true;
    }
    return parseFloat(item.income || 0) - parseFloat(item.expense || 0) >= 0;
  });

  return (
    <ResponsiveContainer width="100%" height={props.height || 300}>
      <AreaChart
        data={[...filteredData].sort(
          (a, b) => new Date(a.date) - new Date(b.date)
        )}
        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
      >
        <defs>
          <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00FF00" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#00FF00" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#DC143C" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#DC143C" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="6 6" />
        <XAxis dataKey="date" tick={chartAxisTick} />
        <YAxis tick={chartAxisTick} />
        <Tooltip content={<AreaChartChartToolTip />} />
        <Area
          type="monotone"
          dataKey="income"
          stroke="#00FF00"
          fillOpacity={1}
          fill="url(#colorIncome)"
        />
        <Area
          type="monotone"
          dataKey="expense"
          stroke="#DC143C"
          fillOpacity={1}
          fill="url(#colorExpense)"
        />
        <Legend content={<CustomLegend />} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

const AreaChartChartToolTip = ({ active, payload }) => {
  const global = useGlobalContext();
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    return (
      <div
        style={{
          backgroundColor: "var(--chart-tooltip-bg)",
          padding: "5px",
          borderRadius: "3px",
          color: "var(--chart-tooltip-text)",
          height: "fit-content",
        }}
      >
        {`${data.date}`}
        <br />
        Earned:{" "}
        <b>
          {`${helper.showOrMask(
            global.privacyMode,
            parseFloat(data.income, 2)
          )}`}{" "}
          {helper.getCurrency(global.globalCurrency)}
        </b>
        <br />
        Spent:{" "}
        <b>
          {`${helper.showOrMask(
            global.privacyMode,
            parseFloat(data.expense, 2)
          )}`}{" "}
          {helper.getCurrency(global.globalCurrency)}
        </b>
        <br />
        Saved:{" "}
        <b>
          {helper.showOrMask(
            global.privacyMode,
            parseFloat(data.income - data.expense).toFixed(2)
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
        backgroundColor: "var(--chart-label-bg)",
        color: "var(--chart-label-text)",
        padding: "7px",
        width: "90%",
        borderRadius: "3px",
        cursor: "pointer",
      }}
    >
      Shows monthly incomes vs expenses for the last 12 months.
    </div>
  );
};

export default IncomeVsExpenseChart;
