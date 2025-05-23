import { useEffect, useState } from "react";
import { useGlobalContext } from "../../context/GlobalContext";
import { helper } from "../helper";
import {
  Area,
  CartesianGrid,
  Legend,
  Bar,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from "recharts";
import statService from "../../services/transactionService/statService";

const WealthOverTime = (props) => {
  const global = useGlobalContext();
  const [data, setData] = useState(null);
  const [filteredData, setFilteredData] = useState(null);
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState("All Time");
  const [aggs, setAggs] = useState("");

  useEffect(() => {
    async function fetchWealthStats() {
      const wealthStats = await statService.getWealthStats(
        global.globalCurrency
      );
      const uniqueYears = [
        ...new Set(
          wealthStats["monthly_differences"].map(
            (item) => item.date.split("-")[0]
          )
        ),
      ];
      if (years.length === 0) {
        setYears(["All Time", ...uniqueYears]);
      }
      setData(wealthStats["monthly_differences"]);
    }
    fetchWealthStats();
  }, [global.globalCurrency]);

  useEffect(() => {
    filterData(selectedYear);
  }, [data]);

  function filterData(year) {
    if (year === "All Time") {
      setFilteredData(data);
    } else {
      setFilteredData(data.filter((item) => item.date.startsWith(year)));
    }
  }

  const handleYearChange = (event) => {
    const year = event.target.value;
    setSelectedYear(year);
    filterData(year);
  };

  useEffect(() => {
    if (filteredData) {
      calculateAggregations();
    }
  }, [filteredData]);

  const calculateGrowthRate = (values) => {
    if (!values || values.length < 2) return [];

    const growthRates = [];
    for (let i = 1; i < values.length; i++) {
      const previous = values[i - 1];
      const current = values[i];
      const growthRate = ((current - previous) / Math.abs(previous)) * 100;
      growthRates.push(growthRate);
    }

    return growthRates;
  };

  const calculateAggregations = () => {
    if (!filteredData || filteredData.length === 0) {
      return;
    }

    const netDifferences = filteredData.map((item) => item.net_difference);
    const totalWealthPerMonth = filteredData.map((item) => item.monthly_wealth);

    const sum = netDifferences.reduce((acc, value) => acc + value, 0);
    const average = sum / netDifferences.length;
    const min = Math.min(...netDifferences);
    const max = Math.max(...netDifferences);
    const wealthGrowthRate = calculateGrowthRate(totalWealthPerMonth);
    const avgWealthGrowthRate =
      wealthGrowthRate.reduce((sum, val) => sum + val, 0) /
      wealthGrowthRate.length;
    const netSavingsGrowthRate = calculateGrowthRate(netDifferences);
    const avgNetSavingsGrowthRate =
      netSavingsGrowthRate.reduce((sum, val) => sum + val, 0) /
      netSavingsGrowthRate.length;

    setAggs({
      sum: sum,
      average: average,
      min: min,
      max: max,
      avgWealthGrowthRate: avgWealthGrowthRate,
      avgNetSavingsGrowthRate: avgNetSavingsGrowthRate,
    });
  };

  return (
    <ComposedChart
      width={props.width}
      height={props.height}
      data={filteredData?.sort((a, b) => new Date(a.date) - new Date(b.date))}
      margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
      id="wealth_over_time_chart"
    >
      <defs>
        <linearGradient id="colorLine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#5F9EA0" stopOpacity={0.8} />{" "}
          <stop offset="50%" stopColor="#7FB5B5" stopOpacity={0.5} />{" "}
          <stop offset="95%" stopColor="#2F4F4F" stopOpacity={0} />{" "}
        </linearGradient>
      </defs>

      <CartesianGrid strokeDasharray="6 6" />
      <XAxis dataKey="date" />
      <YAxis yAxisId={"left"} orientation="left" />
      <YAxis yAxisId={"right"} orientation="right" tick={{ fill: "#8884d8" }} />
      <Tooltip content={<AreaChartChartToolTip />} />
      <Legend
        content={(props) => (
          <CustomLegend
            selectedYear={selectedYear}
            handleYearChange={handleYearChange}
            years={years}
            aggs={aggs}
          />
        )}
      />
      <Area
        type="monotone"
        dataKey="monthly_wealth"
        stroke="cadetblue"
        fillOpacity={1}
        fill="url(#colorLine)"
        yAxisId={"left"}
      />
      <Bar
        dataKey="net_difference"
        fill="#90EE90"
        barSize={20}
        name="Net Difference"
        yAxisId={"right"}
        shape={<NetSavingsBar />}
      />
    </ComposedChart>
  );
};

const AreaChartChartToolTip = ({ active, payload }) => {
  const global = useGlobalContext();

  // Function to convert "YYYY-MM" to "Month YYYY"
  const formatDate = (dateString) => {
    const [year, month] = dateString.split("-");
    const date = new Date(year, month - 1); // Month is 0-indexed
    return date.toLocaleString("en-US", { month: "long", year: "numeric" });
  };

  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    return (
      <div
        style={{
          backgroundColor: "cadetblue",
          padding: "5px",
          borderRadius: "3px",
          color: "white",
          height: "fit-content",
        }}
      >
        <p
          style={{
            margin: 0,
            textAlign: "left",
            fontSize: "12px",
            textDecoration: "underline",
          }}
        >
          {formatDate(data.date)}
        </p>
        <p
          style={{
            margin: 0,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          Total:{" "}
          <b
            style={{
              display: "block",
              textAlign: "right",
              fontWeight: "bold",
            }}
          >
            {helper.showOrMask(
              global.privacyMode,
              helper.formatNumber(parseFloat(data.monthly_wealth).toFixed(2))
            )}{" "}
            {helper.getCurrency(global.globalCurrency)}
          </b>
        </p>
        <p style={{ margin: 0 }}>
          Net savings:{" "}
          <b>
            {helper.showOrMask(
              global.privacyMode,
              helper.formatNumber(parseFloat(data.net_difference).toFixed(2))
            )}{" "}
            {helper.getCurrency(global.globalCurrency)}
          </b>
        </p>
      </div>
    );
  }

  return null;
};

const NetSavingsBar = (props) => {
  const { x, y, width, height, payload } = props;
  const fillColor = payload.net_difference < 0 ? "red" : "green";
  const [isHovered, setIsHovered] = useState(false);
  const adjustedY = payload.net_difference < 0 ? y + height : y;
  const adjustedHeight = Math.abs(height);

  return (
    <rect
      x={x}
      y={adjustedY}
      width={width}
      height={adjustedHeight}
      fill={fillColor}
      opacity={isHovered ? 1 : 0.4}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    />
  );
};

const CustomLegend = ({ years, handleYearChange, selectedYear, aggs }) => {
  const global = useGlobalContext();
  return (
    <>
      <div id={"wealth_over_time_legend"}>
        <div className={"header"}>
          <label>Total wealth over time and monthly net savings.</label>
          <div style={{ textAlign: "center" }}>
            <select value={selectedYear} onChange={handleYearChange}>
              {years?.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={"aggregations"}>
          <table className="aggregations-table">
            <tbody>
              <tr>
                <td>Total Savings</td>
                <td>
                  {helper.showOrMask(
                    global.privacyMode,
                    helper.formatNumber(aggs.sum)
                  )}{" "}
                  {helper.getCurrency(global.globalCurrency)}
                </td>
              </tr>
              <tr>
                <td>Average</td>
                <td>
                  {helper.showOrMask(
                    global.privacyMode,
                    helper.formatNumber(aggs.average)
                  )}{" "}
                  {helper.getCurrency(global.globalCurrency)}
                </td>
              </tr>
              <tr>
                <td>Min | Max</td>
                <td>
                  {helper.showOrMask(
                    global.privacyMode,
                    helper.formatNumber(aggs.min)
                  )}{" "}
                  {helper.getCurrency(global.globalCurrency)} |{" "}
                  {helper.showOrMask(
                    global.privacyMode,
                    helper.formatNumber(aggs.max)
                  )}{" "}
                  {helper.getCurrency(global.globalCurrency)}
                </td>
              </tr>
              <tr>
                <td>Average Wealth Growth Rate</td>
                <td>
                  {helper.showOrMask(
                    global.privacyMode,
                    helper.formatNumber(aggs.avgWealthGrowthRate)
                  )}{" "}
                  %
                </td>
              </tr>
              <tr>
                <td>Average Net Savings Growth Rate</td>
                <td>
                  {helper.showOrMask(
                    global.privacyMode,
                    helper.formatNumber(aggs.avgNetSavingsGrowthRate)
                  )}{" "}
                  %
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default WealthOverTime;
