import { Formik, Form, Field } from "formik";
import React, { useEffect, useState } from "react";
import transactionService from "../../services/transactionService/transactionService";
import "react-datepicker/dist/react-datepicker.css";
import "./expenses.scss";
import NoDataCard from "../core/nodata";
import { useToast } from "../../context/ToastContext";
import { helper } from "../helper";
import currencyService from "../../services/currencyService";
import TransactionPopup from "../core/transaction_popup";
import CurrentExpensesBarChart from "../stats/currentExpensesBarChart";
import { useGlobalContext } from "../../context/GlobalContext";
import LoadingCard from "../core/LoadingCard";
import { validationSchemas } from "../../validationSchemas";
import TransactionItem from "./transactionItem";

const Expenses = () => {
  const global = useGlobalContext();
  const [accounts, setAccounts] = useState(global.activeAccounts);

  const [shownExpenses, setShownExpenses] = useState([]);
  const [transactionPopup, setTransactionPopup] = useState(false);

  useEffect(() => {
    setAccounts(global.activeAccounts);
  }, [global.activeAccounts]);

  function getAccountCurrency(id) {
    const account = global.accounts?.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  return (
    <div className={"expenses-wrapper"}>
      <Sidebar
        accounts={accounts}
        refreshAccounts={global.updateAccounts}
        categories={global.expenseCategories}
        shownExpenses={shownExpenses}
        refreshExpenses={global.updateExpenses}
        dateRange={global.dateRange}
        getAccountCurrency={getAccountCurrency}
      />
      {!global.expenses ? (
        <LoadingCard header="Loading Expenses..." />
      ) : global.expenses && !global.expenses?.length ? (
        <NoDataCard
          header={"No expenses found."}
          label={"Add an expense"}
          focusOn={"date"}
        />
      ) : (
        <ExpensesList
          expenses={global.expenses}
          shownExpenses={shownExpenses}
          setShownExpenses={setShownExpenses}
          accounts={accounts}
          categories={global.expenseCategories}
          dateRange={global.dateRange}
          getAccountCurrency={getAccountCurrency}
          refreshExpenses={global.updateExpenses}
          setTransactionPopup={setTransactionPopup}
        />
      )}
      {transactionPopup && (
        <TransactionPopup
          transaction={transactionPopup}
          showPopup={setTransactionPopup}
          refreshTransactions={global.updateExpenses}
          getAccountCurrency={getAccountCurrency}
        />
      )}
    </div>
  );
};

const Sidebar = (props) => {
  const global = useGlobalContext();
  const [totalShownExpenses, setTotalShownExpenses] = useState(false);
  const [shownExpenseRate, setShownExpenseRate] = useState(false);

  useEffect(() => {
    async function getTotal() {
      let promises = props.shownExpenses?.map(async (e) => {
        return await currencyService.convert(
          props.getAccountCurrency(e.from_account),
          global.globalCurrency,
          e.amount
        );
      });

      if (!promises) {
        return;
      }
      const results = await Promise.all(promises);
      let total = results.reduce((acc, curr) => acc + parseFloat(curr), 0);

      setTotalShownExpenses(parseFloat(total).toFixed(2));
    }

    getTotal();
  }, [props.shownExpenses, global.globalCurrency]);

  useEffect(() => {
    async function getExpenseRate() {
      if (totalShownExpenses) {
        if (!global.incomes) {
          return;
        }
        let filteredincomes = global.incomes?.filter(
          (i) =>
            new Date(i.date) >= props.dateRange.from &&
            new Date(i.date) <= props.dateRange.to
        );
        let promises = filteredincomes?.map(async (e) => {
          return await currencyService.convert(
            props.getAccountCurrency(e.to_account),
            global.globalCurrency,
            e.amount
          );
        });

        const results = await Promise.all(promises);
        let totalIncome = results.reduce(
          (acc, curr) => acc + parseFloat(curr),
          0
        );

        if (totalIncome === 0 || totalShownExpenses > totalIncome) {
          setShownExpenseRate(false);
          return;
        }

        const rate = (totalShownExpenses / totalIncome) * 100;

        setShownExpenseRate(parseFloat(rate).toFixed(2));
      }
    }
    getExpenseRate();
  }, [totalShownExpenses, global.globalCurrency]);

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
        <b>
          {helper.showOrMask(
            global.privacyMode,
            helper.formatNumber(totalShownExpenses)
          )}
          {helper.getCurrency(global.globalCurrency)}
        </b>{" "}
        spent{" "}
        <small>
          from{" "}
          {props.dateRange?.from?.toDateString().split(" ").slice(1).join(" ")}{" "}
          to {props.dateRange?.to?.toDateString().split(" ").slice(1).join(" ")}{" "}
        </small>
        {shownExpenseRate && (
          <span>
            or <i>{shownExpenseRate}%</i> of your current income.
          </span>
        )}
      </div>
      <CurrentExpensesBarChart
        expenses={props.shownExpenses}
        categories={props.categories}
        getAccountCurrency={props.getAccountCurrency}
        width={330}
        height={250}
      />
    </div>
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
  const [tags, setTags] = useState([]);
  const [addingExpense, setAddingExpense] = useState(false);

  function addTag(e) {
    e.preventDefault();
    if (!tags.includes(e.target.previousElementSibling.value)) {
      setTags([...tags, e.target.previousElementSibling.value]);
      const input = document.getElementById("add_tag_textfield");
      input.value = "";
      input.focus();
    }
  }

  return (
    <div className={"enter-expense"}>
      <Formik
        initialValues={{
          amount: "",
          description: "",
          date: new Date().toISOString().slice(0, 10),
          from_account: "",
          category: "",
        }}
        validationSchema={validationSchemas.expenseFormSchema}
        validateOnBlur={false}
        validateOnChange={false}
        onSubmit={(values, { setSubmitting, resetForm, validateForm }) => {
          validateForm().then(async () => {
            setAddingExpense(true);
            values["type"] = 1;
            values["tags"] = tags?.map((tag) => ({
              name: tag,
            }));
            await transactionService.addExpense(values);
            await refreshExpenses();
            await refreshAccounts();
            setSubmitting(false);
            setTags([]);
            resetForm();
            showToast("Expense Added", "info");
            setAddingExpense(false);
          });
        }}
      >
        {({ errors, touched }) => (
          <Form className={"form"}>
            <label onClick={() => document.getElementById("date").focus()}>
              Enter Expense
            </label>
            <Field type="text" id="date" name="date" placeholder="Enter date" />
            <Field as="select" name="from_account">
              <option value="" disabled hidden>
                Select account
              </option>
              {accounts
                ?.sort((a, b) => (a.name > b.name ? 1 : -1))
                ?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {parseFloat(a.amount).toFixed(2)}{" "}
                    {helper.getCurrency(getAccountCurrency(a.id))}
                  </option>
                ))}
            </Field>
            <Field type="text" name="amount" placeholder="Enter amount" />
            <div className={"tags_container"}>
              <div className={"tags_container__input"}>
                <input
                  type="text"
                  name="tags"
                  id="add_tag_textfield"
                  placeholder="Enter tags"
                />
                <button
                  type="button"
                  className={"add-tag-button"}
                  onClick={(e) => addTag(e)}
                >
                  + Tag
                </button>
              </div>
              {tags && (
                <div className={"tags_container__shown-tags"}>
                  {tags?.map((t) => (
                    <span className={"tag"} key={t}>
                      {t}
                      <button
                        type="button"
                        className={"remove-tag-button"}
                        onClick={() =>
                          setTags(tags?.filter((tag) => tag !== t))
                        }
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Field
              as="textarea"
              rows={2}
              name="description"
              id="description"
              placeholder="Enter a description"
            />
            <Field as="select" name="category">
              <option value="" disabled hidden>
                Expense category
              </option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.category}
                </option>
              ))}
            </Field>
            <div id="submit_wrapper">
              <button type="submit" id={"submit-button"}>
                Add Expense
              </button>
              {addingExpense && (
                <img
                  src={process.env.PUBLIC_URL + "/loading_icon.gif"}
                  alt="loading icon"
                  width="27"
                  height="27"
                />
              )}
            </div>
            {errors.date && touched.date ? <span>{errors.date}</span> : null}
            {errors.account && touched.account ? (
              <span>{errors.account}</span>
            ) : null}
            {errors.amount && touched.amount ? (
              <span>{errors.amount}</span>
            ) : null}
            {errors.description && touched.description ? (
              <span>{errors.description}</span>
            ) : null}
            {errors.expense_category && touched.expense_category ? (
              <span>{errors.expense_category}</span>
            ) : null}
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
  const global = useGlobalContext();

  function filterExpenses() {
    const selectedAccount = document.getElementById("account").value;
    const selectedCategory = document.getElementById("category").value;

    const fromDate = props.dateRange.from;
    const toDate = props.dateRange.to;

    const accountFilter =
      selectedAccount >= 0
        ? props.expenses?.filter((e) => e.from_account == selectedAccount)
        : props.expenses;

    const categoryFilter =
      selectedCategory >= 0
        ? props.expenses?.filter((e) => e.category == selectedCategory)
        : props.expenses;

    const dateFilter = props.expenses?.filter(
      (e) => new Date(e.date) >= fromDate && new Date(e.date) <= toDate
    );

    const filteredExpenses = accountFilter
      ?.filter((e) => categoryFilter.includes(e))
      ?.filter((e) => dateFilter.includes(e))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
    props.setShownExpenses(filteredExpenses);
  }

  async function sortShownExpenses(by = "") {
    if (!by) {
      return;
    }

    let sorted = null;

    const sortKeyFunction = {
      date: (item) => new Date(item.date),
      amount: async (item) => {
        const convertedAmount = await currencyService.convert(
          props.getAccountCurrency(item.account),
          global.globalCurrency,
          item.amount
        );
        return parseFloat(convertedAmount);
      },
    };

    const transform = sortKeyFunction[by] || ((item) => item[by]);

    // Convert amounts to a single currency
    const itemsWithTransformedValues = await Promise.all(
      props.shownExpenses.map(async (item) => ({
        ...item,
        transformedValue:
          by === "amount" ? await transform(item) : transform(item),
      }))
    );

    if (by in sortedBy) {
      const currentOrder = sortedBy[by];
      // Perform synchronous sorting on the transformed values
      sorted = itemsWithTransformedValues.sort((a, b) =>
        currentOrder === "ascending"
          ? b.transformedValue - a.transformedValue
          : a.transformedValue - b.transformedValue
      );
      setSortedBy({
        [by]: currentOrder === "ascending" ? "descending" : "ascending",
      });
    } else {
      sorted = itemsWithTransformedValues.sort(
        (a, b) => a.transformedValue - b.transformedValue
      );
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
            {global.accounts?.map((a) => (
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
                {c.category}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={"expenses"}>
        {props.shownExpenses?.length > 0 &&
          props.shownExpenses?.map((expense) => (
            <TransactionItem
              key={expense.id}
              transaction={expense}
              refreshTransactions={props.refreshExpenses}
              categories={props.categories}
              currency={helper.getCurrency(
                props.getAccountCurrency(expense.from_account)
              )}
              setTransactionPopup={props.setTransactionPopup}
              refreshAccounts={global.updateAccounts}
            />
          ))}
      </div>
    </div>
  );
};

export default Expenses;
