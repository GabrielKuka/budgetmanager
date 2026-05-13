import { useState, useEffect } from "react";
import "./stats.scss";
import IncomeVsExpenseChart from "./incomeVsExpenseChart";
import { useGlobalContext } from "../../context/GlobalContext";
import MonthlyFinancesSankeyChart from "./monthlyFinancesSankeyChart";
import WealthOverTime from "./wealthOverTime";
import statService from "../../services/transactionService/statService";

const ChartLoading = ({ label = "Loading chart..." }) => (
  <div className="chart-loading">
    <img
      src={process.env.PUBLIC_URL + "/loading_icon.gif"}
      alt="loading icon"
    />
    <span>{label}</span>
  </div>
);

const Stats = () => {
  const global = useGlobalContext();

  const [profileStats, setProfileStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function getProfileStats() {
      setIsLoadingStats(true);
      const data = await statService.getProfileStats(global.globalCurrency);
      if (!ignore) {
        setProfileStats(data);
        setIsLoadingStats(false);
      }
    }

    getProfileStats();
    return () => {
      ignore = true;
    };
  }, [global.globalCurrency]);

  return (
    <div className={"stats-wrapper"}>
      {global.incomes?.length > 0 &&
        global.expenses?.length > 0 &&
        global.expenseCategories?.length > 0 && (
          <>
            <div className={"chart-container"}>
              {isLoadingStats ? (
                <ChartLoading label="Loading monthly finances..." />
              ) : (
                <MonthlyFinancesSankeyChart
                  data={profileStats?.monthly_finances_sankey}
                />
              )}
            </div>
            <div className={"chart-container wide-chart-container"}>
              {isLoadingStats ? (
                <ChartLoading label="Loading income vs expense..." />
              ) : (
                <IncomeVsExpenseChart
                  height={300}
                  data={profileStats?.income_vs_expense}
                />
              )}
            </div>
            <div className={"chart-container"} id="wealthOverTimeContainer">
              <WealthOverTime height={520} />
            </div>
          </>
        )}
    </div>
  );
};

export default Stats;
