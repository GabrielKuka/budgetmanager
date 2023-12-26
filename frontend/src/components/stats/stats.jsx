import { useState, useEffect } from "react";
import transactionService from "../../services/transactionService/transactionService";
import NetworthPieChart from "./networthPieChart";

import "./stats.scss";
import NetworthBasedOnCurrencyChart from "./currencyChart";
import CurrentExpensesBarChart from "./currentExpensesBarChart";
import IncomeVsExpenseChart from "./incomeVsExpenseChart";
import FoodExpensesChart from "./foodExpensesChart";

const Stats = (props) => {
  const [accounts, setAccounts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);

  const [incomes, setIncomes] = useState([]);
  const [incomeCategories, setIncomeCategories] = useState([]);

  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });

  useEffect(() => {
    getAccounts();

    getExpenseCategories();
    getExpenses();

    getIncomeCategories();
    getIncomes();
  }, []);

  async function getIncomeCategories() {
    const categories = await transactionService.getAllIncomeCategories();
    setIncomeCategories(categories);
  }
  async function getIncomes() {
    const incomes = await transactionService.getAllUserIncomes();
    setIncomes(incomes);
  }

  async function getExpenseCategories() {
    const categories = await transactionService.getAllExpenseCategories();
    setExpenseCategories(categories);
  }

  async function getExpenses() {
    const expenses = await transactionService.getAllUserExpenses();
    setExpenses(expenses);
  }

  async function getAccounts() {
    const accounts = await transactionService.getAllUserAccounts();
    setAccounts(accounts);
  }

  function getAccountCurrency(id) {
    const account = accounts.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  return (
    <div className={"stats-wrapper"}>
      <div className={"chart-container"}>
        <NetworthPieChart accounts={accounts} />
      </div>
      <div className={"chart-container"}>
        <NetworthBasedOnCurrencyChart accounts={accounts} />
      </div>
      <div className={"chart-container"}>
        <CurrentExpensesBarChart
          expenses={expenses.filter(
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
          expenses={expenses.filter((e) => e.expense_category == 1)}
          incomes={incomes}
          getAccountCurrency={getAccountCurrency}
        />
      </div>
    </div>
  );
};

export default Stats;
