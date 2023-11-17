import { Formik, Form, Field } from "formik";
import React, { useEffect, useRef, useState } from "react";
import transactionService from "../../services/transactionService/transactionService";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./expenses.scss";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";
import NoDataCard from "../core/nodata";
import { useToast } from "../../context/ToastContext";
import { helper } from "../helper";
import currencyService from "../../services/currencyService";

const Expenses = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [expenses, setExpenses] = useState([]);
  const [shownExpenses, setShownExpenses] = useState([]);

  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });

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
    const expenses = await transactionService
      .getAllUserExpenses()
      .finally(() => setIsLoading(false));
    setExpenses(expenses);
  }

  function getAccountCurrency(id) {
    const account = accounts.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  return (
    <div className={"expenses-wrapper"}>
      <Sidebar
        accounts={accounts}
        refreshAccounts={getAccounts}
        categories={categories}
        expenses={expenses}
        shownExpenses={shownExpenses}
        refreshExpenses={getExpenses}
        dateRange={dateRange}
        getAccountCurrency={getAccountCurrency}
      />
      {!isLoading && (
        <>
          {!expenses.length ? (
            <NoDataCard
              header={"No expenses found."}
              label={"Add an expense"}
              focusOn={"date"}
            />
          ) : (
            <ExpensesList
              expenses={expenses}
              shownExpenses={shownExpenses}
              setShownExpenses={setShownExpenses}
              accounts={accounts}
              categories={categories}
              dateRange={dateRange}
              setDateRange={setDateRange}
              getAccountCurrency={getAccountCurrency}
            />
          )}
        </>
      )}
    </div>
  );
};

const Sidebar = (props) => {
  const [totalShownExpenses, setTotalShownExpenses] = useState(0);
  const [expensesPerCategory, setExpensesPerCategory] = useState("");

  useEffect(() => {
    async function getTotal() {
      let promises = props.shownExpenses.map(async (e) => {
        return await currencyService.convert(
          props.getAccountCurrency(e.account),
          "EUR",
          e.amount
        );
      });

      const results = await Promise.all(promises);
      let total = results.reduce((acc, curr) => acc + parseFloat(curr), 0);

      setTotalShownExpenses(parseFloat(total).toFixed(2));
    }

    async function getExpensesPerCategory() {
      const data = [];
      for (const c of props.categories) {
        let promises = props.shownExpenses
          .filter((e) => e.expense_category == c.id)
          .map(async (e) => {
            return await currencyService.convert(
              props.getAccountCurrency(e.account),
              "EUR",
              e.amount
            );
          });

        const results = await Promise.all(promises);
        const total = results.reduce((t, curr) => (t += parseFloat(curr)), 0);
        data.push({
          category: c.category_type,
          amount: parseFloat(total).toFixed(2),
        });
      }

      setExpensesPerCategory(data);
    }

    getExpensesPerCategory();
    getTotal();
  }, [props.shownExpenses]);

  return (
    <div className={"expenses-wrapper__sidebar"}>
      <AddExpense
        accounts={props.accounts}
        categories={props.categories}
        refreshExpenses={props.refreshExpenses}
        refreshAccounts={props.refreshAccounts}
        getAccountCurrency={props.getAccountCurrency}
      />
      <div className={"summary"}>
        <b>{totalShownExpenses}€</b> spent{" "}
        <small>
          from {props.dateRange.from.toDateString()} to{" "}
          {props.dateRange.to.toDateString()}.
        </small>
      </div>
      <Chart data={expensesPerCategory} />
    </div>
  );
};

const Chart = (props) => {
  const [yMaxValue, setYMaxValue] = useState({});

  useEffect(() => {
    if (props.data) {
      setYMaxValue(Math.max(...props.data.map((o) => o.amount)));
    }
  }, [props.data]);

  return (
    <BarChart
      className={"bar-chart"}
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

const AddExpense = ({
  accounts,
  categories,
  refreshExpenses,
  refreshAccounts,
  getAccountCurrency,
}) => {
  const showToast = useToast();

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
          await refreshAccounts();
          showToast("Expense Added", "info");
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
              {accounts
                ?.sort((a, b) => (a.name > b.name ? 1 : -1))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {parseFloat(a.amount).toFixed(2)}{" "}
                    {helper.getCurrency(getAccountCurrency(a.id))}
                  </option>
                ))}
            </Field>
            <Field type="text" name="amount" placeholder="Enter amount" />
            <Field
              type="text"
              name="description"
              placeholder="Enter a description"
            />
            <Field as="select" name="expense_category">
              <option value="" disabled hidden>
                Expense category
              </option>
              {categories?.map((c) => (
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
  const [sortedBy, setSortedBy] = useState({});
  useEffect(filterExpenses, []);
  useEffect(filterExpenses, [props.dateRange, props.expenses]);

  function filterExpenses() {
    const selectedAccount = document.getElementById("account").value;
    const selectedCategory = document.getElementById("category").value;

    const fromDate = props.dateRange.from;
    const toDate = props.dateRange.to;

    const accountFilter =
      selectedAccount >= 0
        ? props.expenses.filter((e) => e.account == selectedAccount)
        : props.expenses;

    const categoryFilter =
      selectedCategory >= 0
        ? props.expenses.filter((e) => e.expense_category == selectedCategory)
        : props.expenses;

    const dateFilter = props.expenses.filter(
      (e) => new Date(e.date) >= fromDate && new Date(e.date) <= toDate
    );

    const filteredExpenses = accountFilter
      .filter((e) => categoryFilter.includes(e))
      .filter((e) => dateFilter.includes(e))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
    props.setShownExpenses(filteredExpenses);
  }

  function sortShownExpenses(by = "") {
    if (!by) {
      return;
    }

    let sorted = null;

    if (by == "date") {
      if ("date" in sortedBy) {
        if (sortedBy["date"] == "ascending") {
          sorted = [...props.shownExpenses].sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          );
          setSortedBy({ date: "descending" });
        } else {
          sorted = [...props.shownExpenses].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
          );
          setSortedBy({ date: "ascending" });
        }
      } else {
        sorted = [...props.shownExpenses].sort(
          (a, b) => new Date(a.date) - new Date(b.date)
        );
        setSortedBy({ date: "ascending" });
      }
      props.setShownExpenses(sorted);
      return;
    }

    if (`${by}` in sortedBy) {
      if (sortedBy[`${by}`] == "ascending") {
        sorted = [...props.shownExpenses].sort(
          (a, b) => b[`${by}`] - a[`${by}`]
        );
        setSortedBy({ [by]: "descending" });
      } else {
        sorted = [...props.shownExpenses].sort(
          (a, b) => a[`${by}`] - b[`${by}`]
        );
        setSortedBy({ [by]: "ascending" });
      }
    } else {
      sorted = [...props.shownExpenses].sort((a, b) => a[`${by}`] - b[`${by}`]);
      setSortedBy({ [by]: "ascending" });
    }
    props.setShownExpenses(sorted);
  }

  return (
    <div className={"expenses-wrapper__expenses-list"}>
      <div className={"header"}>
        <div>
          <label onClick={() => sortShownExpenses("date")}>Date:</label>
          {sortedBy["date"] == "ascending" && (
            <img
              src={`${process.env.PUBLIC_URL}/up_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
          {sortedBy["date"] == "descending" && (
            <img
              src={`${process.env.PUBLIC_URL}/down_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
          <div className={"fromDatePicker"}>
            <span className={"tooltip"}>From: </span>
            <DatePicker
              className="datepicker"
              selected={props.dateRange.from}
              onChange={(date) =>
                props.setDateRange((prev) => ({
                  ...prev,
                  from: date,
                }))
              }
              showMonthDropdown
              dateFormat={"yyyy-MM-dd"}
            />
          </div>
          <div className={"toDatePicker"}>
            <span className={"tooltip"}>To:</span>
            <DatePicker
              className="datepicker"
              selected={props.dateRange.to}
              onChange={(date) =>
                props.setDateRange((prev) => ({
                  ...prev,
                  to: date,
                }))
              }
              showMonthDropdown
              dateFormat={"yyyy-MM-dd"}
            />
          </div>
        </div>
        <label>Description</label>
        <div>
          <label onClick={() => sortShownExpenses("account")}>Account:</label>
          {sortedBy["account"] == "ascending" && (
            <img
              src={`${process.env.PUBLIC_URL}/up_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
          {sortedBy["account"] == "descending" && (
            <img
              src={`${process.env.PUBLIC_URL}/down_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
          <select id="account" defaultValue={"-1"} onChange={filterExpenses}>
            <option value="-1">All</option>
            {props.accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label onClick={() => sortShownExpenses("amount")}>Amount</label>
          {sortedBy["amount"] == "ascending" && (
            <img
              src={`${process.env.PUBLIC_URL}/up_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
          {sortedBy["amount"] == "descending" && (
            <img
              src={`${process.env.PUBLIC_URL}/down_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
        </div>
        <div>
          <label onClick={() => sortShownExpenses("expense_category")}>
            Category:
          </label>
          {sortedBy["expense_category"] == "ascending" && (
            <img
              src={`${process.env.PUBLIC_URL}/up_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
          {sortedBy["expense_category"] == "descending" && (
            <img
              src={`${process.env.PUBLIC_URL}/down_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
          <select id="category" defaultValue="-1" onChange={filterExpenses}>
            <option value="-1">All</option>
            {props.categories?.map((c) => (
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
              currency={helper.getCurrency(
                props.getAccountCurrency(expense.account)
              )}
            />
          ))}
      </div>
    </div>
  );
};

const ExpenseItem = ({ expense, accounts, categories, currency }) => {
  const [showKebab, setShowKebab] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const kebabClicked = !!(
        event.target?.attributes?.class?.value?.includes("kebab-button") ||
        event.target?.attributes?.src?.value?.includes("kebab_icon")
      );

      if (!kebabClicked) {
        setShowKebab(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  function toggleKebab() {
    setShowKebab((prevState) => !prevState);
  }

  function handleDelete() {
    setShowKebab(!showKebab);
  }

  function handleShowMore() {
    setShowKebab(!showKebab);
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
        {parseFloat(expense.amount).toFixed(2)} {currency}
      </label>
      <label id="category">
        {getExpenseCategory(expense.expense_category)}
      </label>
      <button className={"kebab-button"} onClick={toggleKebab}>
        <img src={`${process.env.PUBLIC_URL}/kebab_icon.png`} />
      </button>
      {showKebab && (
        <div className={"kebab-menu"} id={`kebab-menu-${expense.id}`}>
          <button onClick={handleDelete}>Delete</button>
          <button onClick={handleShowMore}>Show more</button>
        </div>
      )}
    </div>
  );
};

export default Expenses;
