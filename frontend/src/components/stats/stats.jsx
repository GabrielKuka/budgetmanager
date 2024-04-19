import { useState, useEffect } from "react";
import NetworthPieChart from "./networthPieChart";

import "./stats.scss";
import NetworthBasedOnCurrencyChart from "./currencyChart";
import CurrentExpensesBarChart from "./currentExpensesBarChart";
import IncomeVsExpenseChart from "./incomeVsExpenseChart";
import FoodExpensesChart from "./foodExpensesChart";
import { useGlobalContext } from "../../context/GlobalContext";

const Stats = () => {
  const global = useGlobalContext();
  const [accounts, setAccounts] = useState(global.accounts);
  const [expenses, setExpenses] = useState(global.expenses);
  const [expenseCategories, setExpenseCategories] = useState(
    global.expenseCategories
  );

  const [incomes, setIncomes] = useState(global.incomes);
  const [incomeCategories, setIncomeCategories] = useState(
    global.incomeCategories
  );

  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });

  useEffect(() => {
    setAccounts(global.accounts);
  }, [global.accounts]);

  useEffect(() => {
    setExpenses(global.expenses);
  }, [global.expenses]);

  useEffect(() => {
    setIncomes(global.incomes);
  }, [global.incomes]);

  useEffect(() => {
    setIncomeCategories(global.incomeCategories);
  }, [global.incomesCategories]);

  useEffect(() => {
    setExpenseCategories(global.expenseCategories);
  }, [global.expenseCategories]);

  function getAccountCurrency(id) {
    const account = accounts?.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  return (
    <div className={"stats-wrapper"}>
      {accounts?.length > 0 && (
        <>
          <div className={"chart-container"}>
            <NetworthPieChart accounts={accounts} />
          </div>
          <div className={"chart-container"}>
            <NetworthBasedOnCurrencyChart accounts={accounts} />
          </div>
        </>
      )}
      {incomes?.length > 0 &&
        expenses?.length > 0 &&
        expenseCategories?.length > 0 && (
          <>
            <div className={"chart-container"}>
              <CurrentExpensesBarChart
                stats={true}
                expenses={expenses?.filter(
                  (e) =>
                    new Date(e.date) >= dateRange.from &&
                    new Date(e.date) <= dateRange.to
                )}
                categories={expenseCategories}
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
                expenses={expenses}
                incomes={incomes}
              />
            </div>
            <div className={"chart-container"}>
              <FoodExpensesChart
                height={310}
                width={580}
                expenses={expenses?.filter((e) => e.expense_category == 11)}
                incomes={incomes}
                getAccountCurrency={getAccountCurrency}
              />
            </div>
          </>
        )}
    </div>
  );
};

export default Stats;
