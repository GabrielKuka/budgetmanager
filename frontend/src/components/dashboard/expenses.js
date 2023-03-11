import { Formik, Form, Field } from "formik";
import React, { useEffect, useState } from "react";
import transactionService from "../../services/transactionService";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./expenses.scss";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";

const Expenses = () => {
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [expenses, setExpenses] = useState([]);
  const [shownExpenses, setShownExpenses] = useState([]);

  const [date, setDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  useEffect(() => {
    getCategories();
    getAccounts();
    getExpenses();
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
    const expenses = await transactionService.getAllUserExpenses();
    setExpenses(expenses);
  }

  return (
    <div className={"expenses-wrapper"}>
      <Sidebar
        accounts={accounts}
        categories={categories}
        expenses={expenses}
        shownExpenses={shownExpenses}
        refreshExpenses={getExpenses}
        date={date}
      />
      {expenses?.length > 0 && (
        <ExpensesList
          expenses={expenses}
          shownExpenses={shownExpenses}
          setShownExpenses={setShownExpenses}
          accounts={accounts}
          categories={categories}
          date={date}
          setDate={setDate}
        />
      )}
    </div>
  );
};

const Sidebar = (props) => {
  function getExpensesPerCategory() {
    const data = [];

    props.categories.forEach((c) => {
      let result = props.shownExpenses
        .filter((e) => e.expense_category == c.id)
        .reduce((t, obj) => (t += parseFloat(obj.amount)), 0)
        .toFixed(2);
      data.push({
        category: c.category_type,
        amount: result,
      });
    });

    return data;
  }

  function getTotal() {
    const total = props.shownExpenses
      .reduce((t, obj) => (t += parseFloat(obj.amount)), 0)
      .toFixed(2);

    return total;
  }

  return (
    <div className={"expenses-wrapper__sidebar"}>
      <AddExpense
        accounts={props.accounts}
        categories={props.categories}
        refreshExpenses={props.refreshExpenses}
      />
      <div className={"summary"}>
        Total money spent: <b>{getTotal()}€</b> since{" "}
        {props.date.toDateString()}.
      </div>
      <Chart data={getExpensesPerCategory()} />
    </div>
  );
};

const Chart = (props) => {
  const yMaxValue = Math.max(...props.data.map((o) => o.amount));
  return (
    <BarChart
      margin={{ left: 0, right: 0 }}
      width={330}
      height={250}
      data={props.data}
      barSize={20}
    >
      <XAxis dataKey="category" />
      <YAxis type="number" tickSize={2} domain={[0, yMaxValue]} />
      <Tooltip />
      <Bar dataKey="amount" fill="#8884d8" />
    </BarChart>
  );
};

const AddExpense = ({ accounts, categories, refreshExpenses }) => {
  return (
    <div className={"enter-expense"}>
      <Formik
        initialValues={{
          amount: "",
          description: "",
          date: new Date().toISOString().slice(0, 10),
          account: "",
          expense_category: "",
        }}
        onSubmit={async (values, { setSubmitting, resetForm }) => {
          values["type"] = 1;
          await transactionService.addExpense(values);
          await refreshExpenses();
          setSubmitting(false);
          resetForm();
        }}
      >
        {() => (
          <Form className={"form"}>
            <label onClick={() => document.getElementById("date").focus()}>
              Enter Expense
            </label>
            <Field type="text" id="date" name="date" placeholder="Enter date" />
            <Field as="select" name="account">
              <option value="" disabled hidden>
                Select account
              </option>
              {accounts &&
                accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {parseFloat(a.amount).toFixed(2)} €
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
            <Field as="select" name="expense_category">
              <option value="" disabled hidden>
                Expense category
              </option>
              {categories &&
                categories.map((c) => (
                  <option key={c.id} value={c.id}>
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

const ExpensesList = (props) => {
  useEffect(filterExpenses, []);
  useEffect(filterExpenses, [props.date]);

  function filterExpenses() {
    const selectedAccount = document.getElementById("account").value;
    const selectedCategory = document.getElementById("category").value;
    const selectedDate = props.date;

    const accountFilter =
      selectedAccount >= 0
        ? props.expenses.filter((e) => e.account == selectedAccount)
        : props.expenses;

    const categoryFilter =
      selectedCategory >= 0
        ? props.expenses.filter((e) => e.expense_category == selectedCategory)
        : props.expenses;

    const dateFilter = props.expenses.filter(
      (e) => new Date(e.date) >= selectedDate
    );

    const filteredExpenses = accountFilter
      .filter((e) => categoryFilter.includes(e))
      .filter((e) => dateFilter.includes(e))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
    props.setShownExpenses(filteredExpenses);
  }

  return (
    <div className={"expenses-wrapper__expenses-list"}>
      <div className={"header"}>
        <div>
          <label>Date:</label>
          <DatePicker
            className="datepicker"
            selected={props.date}
            onChange={(date) => props.setDate(date)}
            showMonthDropdown
            dateFormat={"yyyy-MM-dd"}
          />
        </div>
        <label>Description</label>
        <div>
          <label>Account:</label>
          <select id="account" defaultValue={"-1"} onChange={filterExpenses}>
            <option value="-1">All</option>
            {props.accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <label>Amount</label>
        <div>
          <label>Category:</label>
          <select id="category" defaultValue="-1" onChange={filterExpenses}>
            <option value="-1">All</option>
            {props.categories &&
              props.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.category_type}
                </option>
              ))}
          </select>
        </div>
      </div>
      <div className={"expenses"}>
        {props.shownExpenses?.length > 0 &&
          props.shownExpenses.map((expense) => (
            <ExpenseItem
              key={expense.id}
              expense={expense}
              accounts={props.accounts}
              categories={props.categories}
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
      <label id="amount">{parseFloat(expense.amount).toFixed(2)} €</label>
      <label id="category">
        {getExpenseCategory(expense.expense_category)}
      </label>
    </div>
  );
};

export default Expenses;
