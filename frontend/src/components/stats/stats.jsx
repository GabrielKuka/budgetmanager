import "./stats.scss";
import NetworthPieChart from "./networthPieChart";
import NetworthBasedOnCurrencyChart from "./currencyChart";
import CurrentExpensesBarChart from "./currentExpensesBarChart";
import IncomeVsExpenseChart from "./incomeVsExpenseChart";
import FoodExpensesChart from "./foodExpensesChart";
import { useGlobalContext } from "../../context/GlobalContext";
import MonthlyFinancesSankeyChart from "./monthlyFinancesSankeyChart";

const Stats = () => {
  const global = useGlobalContext();

  const dateRange = {
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  };

  function getAccountCurrency(id) {
    const account = global.accounts?.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  return (
    <div className={"stats-wrapper"}>
      {global.accounts?.length > 0 && (
        <>
          <div className={"chart-container"}>
            <NetworthPieChart accounts={global.accounts} />
          </div>
          <div className={"chart-container"}>
            <NetworthBasedOnCurrencyChart accounts={global.accounts} />
          </div>
        </>
      )}
      {global.incomes?.length > 0 &&
        global.expenses?.length > 0 &&
        global.expenseCategories?.length > 0 && (
          <>
            <div className={"chart-container"}>
              <CurrentExpensesBarChart
                stats={true}
                expenses={global.expenses?.filter(
                  (e) =>
                    new Date(e.date) >= dateRange.from &&
                    new Date(e.date) <= dateRange.to
                )}
                categories={global.expenseCategories}
                getAccountCurrency={getAccountCurrency}
                height={310}
                width={480}
              />
            </div>
            <div className={"chart-container"}>
              <IncomeVsExpenseChart
                getAccountCurrency={getAccountCurrency}
                height={310}
                width={580}
                expenses={global.expenses}
                incomes={global.incomes}
              />
            </div>
            <div className={"chart-container"}>
              <FoodExpensesChart
                height={310}
                width={580}
                expenses={global.expenses?.filter(
                  (e) => e.expense_category == 11
                )}
                incomes={global.incomes}
                getAccountCurrency={getAccountCurrency}
              />
            </div>
            <div className={"chart-container"}>
              <MonthlyFinancesSankeyChart
                getAccountCurrency={getAccountCurrency}
                incomes={global.incomes}
                incomeCategories={global.incomeCategories}
                expenses={global.expenses}
                expenseCategories={global.expenseCategories}
                accounts={global.accounts}
                dateRange={dateRange}
              />
            </div>
          </>
        )}
    </div>
  );
};

export default Stats;
