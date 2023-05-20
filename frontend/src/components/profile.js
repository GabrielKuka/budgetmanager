import { React, useEffect, useState } from "react";
import userService from "../services/userService";
import transactionService from "../services/transactionService/transactionService";
import {Link} from 'react-router-dom'
import "./profile.scss";

const Profile = () => {
  const [userData, setUserData] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    getUserData();
    getCategories()
    getAccounts()
    getExpenses()
  }, []);


  async function getCategories() {
    const categories = await transactionService.getAllExpenseCategories();
    setCategories(categories);
  }

  async function getAccounts() {
    const accounts = await transactionService.getAllUserAccounts();
    setAccounts(accounts);
  }

  async function getExpenses() {
    let expenses = await transactionService
      .getAllUserExpenses()
      .finally(() => setIsLoading(false));
    expenses.sort((a, b) => (a.date > b.date ? -1 : 1))
    expenses = expenses.slice(0, 5)
    setExpenses(expenses);
  }

  async function getUserData() {
    const response = await userService.getUserData();
    setUserData(response);
  }

  return (
    <div className={"profile-wrapper"}>
      <div className={"profile-wrapper__sidebar"}>
        <div className={"user-data"}>
          <img
            alt="user-icon"
            src={process.env.PUBLIC_URL + "/user-icon.png"}
          />
          <div>
            Full name: <label>{userData.name}</label>
          </div>
          <div>
            Email: <label>{userData.email}</label>
          </div>
          <div>
            Phone: <label>{userData.phone}</label>
          </div>
        </div>
        <hr />
      </div>
      <div className={"profile-wrapper__board"}>
        <RecentExpenses expenses={expenses} accounts={accounts} categories={categories}/>
      </div>
    </div>
  );
};

const RecentExpenses = (props)=>{

  return (
      <div className={"expenses"}>
        <div className={'header'}>
          <label className={'main-title'}>Recent Expenses:</label>

          <Link className={'more-link'} to="/dashboard">More Expenses</Link>
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
  )
}


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

  return (
    <div className="expense-item">
      {isRecent(expense.created_on) && (
        <label className="new-transaction">NEW!</label>
      )}
      <label id="date">{expense.date}</label>
      <label id="description">{expense.description}</label>
      <label id="account">{getAccountName(expense.account)}</label>
      <label id="amount">{parseFloat(expense.amount).toFixed(2)} €</label>
      <label id="category">
        {getExpenseCategory(expense.expense_category)}
      </label>
    </div>
  );
};


export default Profile;
