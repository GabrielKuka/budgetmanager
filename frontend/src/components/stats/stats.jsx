import { useState, useEffect } from "react";
import transactionService from "../../services/transactionService/transactionService";
import NetworthPieChart from "./networthPieChart";

import "./stats.scss";
import NetworthBasedOnCurrencyChart from "./currencyChart";

const Stats = (props) => {
  const [accounts, setAccounts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);

  const [incomes, setIncomes] = useState([]);
  const [incomeCategories, setIncomeCategories] = useState([]);

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

  return (
    <div className={"stats-wrapper"}>
      <div>
        <NetworthPieChart accounts={accounts} />
      </div>
      <div>
        <NetworthBasedOnCurrencyChart accounts={accounts} />
      </div>
      <div>Item 3</div>
      <div>Item 4</div>
    </div>
  );
};

export default Stats;
