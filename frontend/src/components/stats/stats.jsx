import { useState, useEffect } from "react";
import "./stats.scss";
import NetworthPieChart from "./networthPieChart";
import NetworthBasedOnCurrencyChart from "./currencyChart";
import CurrentExpensesBarChart from "./currentExpensesBarChart";
import IncomeVsExpenseChart from "./incomeVsExpenseChart";
import FoodExpensesChart from "./foodExpensesChart";
import { useGlobalContext } from "../../context/GlobalContext";
import MonthlyFinancesSankeyChart from "./monthlyFinancesSankeyChart";
import PercentExpensesPieChart from "./percentExpensesPie";
import transactionService from "../../services/transactionService/transactionService";
import WealthOverTime from "./wealthOverTime";
import WealthByAccounts from "./wealthByAccounts";

const Stats = () => {
  const global = useGlobalContext();

  const dateRange = {
    from: new Date(new Date().getFullYear() - 3, 0, 1),
    to: new Date(),
  };

  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);

  useEffect(() => {
    async function getTransactions() {
      const data = await transactionService.getTransactions(dateRange);
      setExpenses(data.expenses);
      setIncomes(data.incomes);
    }

    getTransactions();
  }, []);

  function getAccountCurrency(id) {
    const account = global.accounts?.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  return (
    <div className={"stats-wrapper"}>
      {global.incomes?.length > 0 &&
        global.expenses?.length > 0 &&
        global.expenseCategories?.length > 0 && (
          <>
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
                height={280}
                width={420}
              />
            </div>
            <div className={"chart-container"}>
              <IncomeVsExpenseChart
                getAccountCurrency={getAccountCurrency}
                height={300}
                width={480}
                expenses={expenses}
                incomes={incomes}
              />
            </div>
            <div className={"chart-container"} id="wealthOverTimeContainer">
              <WealthOverTime
                getAccountCurrency={getAccountCurrency}
                height={600}
                width={1000}
                expenses={expenses}
                incomes={incomes}
              />
            </div>
            <div className={"chart-container"}>
              <FoodExpensesChart
                height={330}
                width={1000}
                expenses={expenses?.filter((e) => e.category === 11)}
                incomes={incomes}
                getAccountCurrency={getAccountCurrency}
              />
            </div>
            <div className={"chart-container"}>
              <PercentExpensesPieChart
                expenses={global.expenses?.filter(
                  (e) =>
                    new Date(e.date) >= dateRange.from &&
                    new Date(e.date) <= dateRange.to
                )}
                categories={global.expenseCategories}
                getAccountCurrency={getAccountCurrency}
              />
            </div>
          </>
        )}
      {global.accounts?.length > 0 && global.activeAccounts?.length > 0 && (
        <>
          <div className={"chart-container"}>
            <NetworthPieChart accounts={global.accounts} />
          </div>
          <div className={"chart-container"}>
            <NetworthBasedOnCurrencyChart accounts={global.accounts} />
            <label className="chart_label">
              Percentage of liquid wealth per currency.
            </label>
          </div>
          <div className={"chart-container"}>
            <WealthByAccounts
              accounts={global.activeAccounts.filter((a) => a.amount > 0)}
            />
            <label className="chart_label">
              Percentage of balances per account (cash included).
            </label>
          </div>
        </>
      )}
    </div>
  );
};

export default Stats;
