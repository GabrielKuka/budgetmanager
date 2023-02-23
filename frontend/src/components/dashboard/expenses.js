import { Formik, Form, Field } from "formik";
import React, { useEffect, useState } from "react";
import transactionService from "../../services/transactionService";
import "./expenses.scss";

const Expenses = () => {
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    async function getCategories() {
      const categories = await transactionService.getAllExpenseCategories();
      setCategories(categories);
    }

    async function getAccounts() {
      const accounts = await transactionService.getAllUserAccounts();
      setAccounts(accounts);
    }

    async function getExpenses() {
      const expenses = await transactionService.getAllUserExpenses();
      setExpenses(expenses);
    }

    getCategories();
    getAccounts();
    getExpenses();
  }, []);

  return (
    <div className={"expenses-wrapper"}>
      <AddExpense accounts={accounts} categories={categories} />
      <ExpensesList
        expenses={expenses}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
};

const AddExpense = ({ accounts, categories }) => {
  return (
    <div className={"expenses-wrapper__enter-expense"}>
      <Formik
        initialValues={{
          amount: "",
          description: "",
          date: new Date().toISOString().slice(0, 10),
        }}
        onSubmit={(values) => {
          console.log(values);
        }}
      >
        {() => (
          <Form className={"form"}>
            <label>Enter expense</label>
            <Field type="text" name="date" placeholder="Enter date" />
            <Field as="select" name="account" defaultValue="">
              <option value="" disabled hidden>
                Select account
              </option>
              {accounts &&
                accounts.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name} {parseInt(a.amount).toFixed(2)} €
                  </option>
                ))}
            </Field>
            <Field
              type="text"
              name="amount"
              placeholder="Enter amount in EUR."
            />
            <Field
              type="text"
              name="description"
              placeholder="Enter a description"
            />
            <Field as="select" name="category" defaultValue="">
              <option value="" disabled hidden>
                Expense category
              </option>
              {categories &&
                categories.map((c) => (
                  <option key={c.id} value={c.category_type}>
                    {c.category_type}
                  </option>
                ))}
            </Field>
            <button type="submit">Submit</button>
          </Form>
        )}
      </Formik>
    </div>
  );
};

const ExpensesList = ({ expenses, accounts, categories }) => {
  const [shownExpenses = expenses, setShownExpenses] = useState();

  return (
    <div className={"expenses-wrapper__expenses-list"}>
      <div className={"header"}>
        <label>Date</label>
        <label>Description</label>
        <label>Account</label>
        <label>Amount</label>
        <label>Category</label>
      </div>
      <div className={"expenses"}>
        {shownExpenses?.length > 0 &&
          shownExpenses.map((expense) => (
            <ExpenseItem
              key={expense.id}
              expense={expense}
              accounts={accounts}
              categories={categories}
            />
          ))}
      </div>
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

  return (
    <div className="expense-item">
      <label id="date">{expense.date}</label>
      <label id="description">{expense.description}</label>
      <label id="account">{getAccountName(expense.account)}</label>
      <label id="amount">{parseInt(expense.amount).toFixed(2)} €</label>
      <label id="category">
        {getExpenseCategory(expense.expense_category)}
      </label>
    </div>
  );
};

export default Expenses;
