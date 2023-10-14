import { React, useEffect, useState } from "react";
import userService from "../services/userService";
import transactionService from "../services/transactionService/transactionService";
import { Link } from "react-router-dom";
import { helper } from "./helper";
import "./profile.scss";

const Profile = () => {
  const [userData, setUserData] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [incomeCategories, setIncomeCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [transfers, setTransfers] = useState([]);

  useEffect(() => {
    getUserData();
    getAccounts();

    getExpenseCategories();
    getIncomeCategories();

    getIncomes();
    getExpenses();
    getTransfers();

    console.log(accounts);
  }, []);

  async function getExpenseCategories() {
    const categories = await transactionService.getAllExpenseCategories();
    setExpenseCategories(categories);
  }

  async function getIncomeCategories() {
    const categories = await transactionService.getAllIncomeCategories();
    setIncomeCategories(categories);
  }

  async function getAccounts() {
    let accounts = await transactionService.getAllUserAccounts();
    setAccounts(accounts);
  }

  async function getIncomes() {
    let incomes = await transactionService
      .getAllUserIncomes()
      .finally(() => setIsLoading(false));
    incomes.sort((a, b) => (a.date > b.date ? -1 : 1));
    incomes = incomes.slice(0, 5);
    setIncomes(incomes);
  }

  async function getExpenses() {
    let expenses = await transactionService
      .getAllUserExpenses()
      .finally(() => setIsLoading(false));
    expenses.sort((a, b) => (a.date > b.date ? -1 : 1));
    expenses = expenses.slice(0, 5);
    setExpenses(expenses);
  }

  async function getTransfers() {
    let transfers = await transactionService
      .getAllUserTransfers()
      .finally(() => setIsLoading(false));
    transfers.sort((a, b) => (a.date > b.date ? -1 : 1));
    transfers = transfers.slice(0, 5);
    setTransfers(transfers);
  }

  async function getUserData() {
    const response = await userService.getUserData();
    setUserData(response);
  }

  return (
    <div className={"profile-wrapper"}>
      <Sidebar userData={userData} accounts={accounts} />
      <div className={"profile-wrapper__board"}>
        <RecentExpenses
          expenses={expenses}
          accounts={accounts}
          categories={expenseCategories}
        />
        <RecentIncomes
          incomes={incomes}
          accounts={accounts}
          categories={incomeCategories}
        />
        <RecentTransfers transfers={transfers} accounts={accounts} />
      </div>
    </div>
  );
};

const Sidebar = (props) => {
  function getAccountCurrency(id) {
    const account = props.accounts?.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }
  return (
    <div className={"profile-wrapper__sidebar"}>
      <div className={"user-data"}>
        <img alt="user-icon" src={process.env.PUBLIC_URL + "/user-icon.png"} />
        <div>
          Full name: <label>{props.userData.name}</label>
        </div>
        <div>
          Email: <label>{props.userData.email}</label>
        </div>
        <div>
          Phone: <label>{props.userData.phone}</label>
        </div>
      </div>
      <hr />
      <div className={"accounts-glimpse"}>
        <div className={"header"}>
          <label className={"main-title"}>Accounts:</label>
          <Link className={"more-link"} to="/accounts">
            More Accounts
          </Link>
        </div>
        <div className={"accounts-list"}>
          {props.accounts?.length > 0 &&
            props.accounts
              .filter((a) => a.amount > 0)
              .slice(0, 5)
              .map((a) => (
                <div key={a.id} className={"account-item"}>
                  <label className={"name"}>{a.name}</label>
                  <label className={"amount"}>
                    {parseFloat(a.amount).toFixed(2)}{" "}
                    {helper.getCurrency(getAccountCurrency(a.id))}
                  </label>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
};

const RecentExpenses = (props) => {
  return (
    <div className={"expenses"}>
      <div className={"header"}>
        <label className={"main-title"}>Recent Expenses:</label>

        <Link className={"more-link"} to="/dashboard/expenses">
          More Expenses
        </Link>
      </div>
      {props.expenses?.length > 0 &&
        props.expenses.map((expense) => (
          <ExpenseItem
            key={expense.id}
            expense={expense}
            accounts={props.accounts}
            categories={props.categories}
          />
        ))}
    </div>
  );
};

const ExpenseItem = ({ expense, accounts, categories }) => {
  function getAccountName(id) {
    const account = accounts.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].name;
    }
    return "Not found";
  }

  function getExpenseCategory(id) {
    const category = categories.filter((c) => c.id === id);
    if (category?.length === 1) {
      return category[0].category_type;
    }
    return "Not found.";
  }

  function isRecent(input_datetime) {
    const now = new Date();
    input_datetime = new Date(input_datetime);
    const diffInMs = now.getTime() - input_datetime.getTime();
    const diffInHrs = diffInMs / (1000 * 60 * 60);
    return diffInHrs <= 5;
  }

  function getAccountCurrency(id) {
    const account = accounts.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  return (
    <div className="expense-item">
      {isRecent(expense.created_on) && (
        <label className="new-transaction">NEW!</label>
      )}
      <label id="date">{expense.date}</label>
      <label id="description">{expense.description}</label>
      <label id="account">{getAccountName(expense.account)}</label>
      <label id="amount">
        {parseFloat(expense.amount).toFixed(2)}{" "}
        {helper.getCurrency(getAccountCurrency(expense.account))}
      </label>
      <label id="category">
        {getExpenseCategory(expense.expense_category)}
      </label>
    </div>
  );
};

const RecentIncomes = (props) => {
  return (
    <div className={"incomes"}>
      <div className={"header"}>
        <label className={"main-title"}>Recent Incomes:</label>
        <Link className={"more-link"} to="/dashboard/incomes">
          More Incomes
        </Link>
      </div>
      <div className={"incomes"}>
        {props.incomes?.length > 0 &&
          props.incomes.map((income) => (
            <IncomeItem
              key={income.id}
              income={income}
              accounts={props.accounts}
              categories={props.categories}
            />
          ))}
      </div>
    </div>
  );
};

const IncomeItem = ({ income, accounts, categories }) => {
  function getAccountName(id) {
    const account = accounts.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].name;
    }
    return "Not found";
  }

  function getIncomeCategory(id) {
    const category = categories.filter((c) => c.id === id);
    if (category?.length === 1) {
      return category[0].category_type;
    }
    return "Not found.";
  }
  function isRecent(input_datetime) {
    const now = new Date();
    input_datetime = new Date(input_datetime);
    const diffInMs = now.getTime() - input_datetime.getTime();
    const diffInHrs = diffInMs / (1000 * 60 * 60);
    return diffInHrs <= 5;
  }

  function getAccountCurrency(id) {
    const account = accounts.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  return (
    <div className="income-item">
      {isRecent(income.created_on) && (
        <label className="new-transaction">NEW!</label>
      )}
      <label id="date">{income.date}</label>
      <label id="description">{income.description}</label>
      <label id="account">{getAccountName(income.account)}</label>
      <label id="amount">
        {parseFloat(income.amount).toFixed(2)}{" "}
        {helper.getCurrency(getAccountCurrency(income.account))}
      </label>
      <label id="category">{getIncomeCategory(income.income_category)}</label>
    </div>
  );
};

const RecentTransfers = ({ transfers, accounts }) => {
  return (
    <div className={"transfers"}>
      <div className={"header"}>
        <label className={"main-title"}>Recent Transfers:</label>
        <Link className={"more-link"} to="/dashboard/transfers">
          More Transfers
        </Link>
      </div>
      <div className={"transfers"}>
        {transfers?.length > 0 &&
          transfers.map((transfer) => (
            <TransferItem
              key={transfer.id}
              transfer={transfer}
              accounts={accounts}
            />
          ))}
      </div>
    </div>
  );
};

const TransferItem = ({ transfer, accounts }) => {
  function getAccountName(id) {
    const account = accounts.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].name;
    }
    return "Not found";
  }

  function isRecent(input_datetime) {
    const now = new Date();
    input_datetime = new Date(input_datetime);
    const diffInMs = now.getTime() - input_datetime.getTime();
    const diffInHrs = diffInMs / (1000 * 60 * 60);
    return diffInHrs <= 5;
  }
  function getAccountCurrency(id) {
    const account = accounts.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  return (
    <div className="transfer-item">
      {isRecent(transfer.created_on) && (
        <label className="new-transaction">NEW!</label>
      )}
      <label id="date">{transfer.date}</label>
      <label id="description">{transfer.description}</label>
      <label id="from_account">{getAccountName(transfer.from_account)}</label>
      <label id="to_account">{getAccountName(transfer.to_account)}</label>
      <label id="amount">
        {parseFloat(transfer.amount).toFixed(2)}{" "}
        {helper.getCurrency(getAccountCurrency(transfer.from_account))}
      </label>
    </div>
  );
};

export default Profile;
