import { Formik, Form, Field } from "formik";
import React, { useEffect, useRef, useState } from "react";
import transactionService from "../../services/transactionService/transactionService";
import "react-datepicker/dist/react-datepicker.css";
import "./expenses.scss";
import NoDataCard from "../core/nodata";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { helper } from "../helper";
import currencyService from "../../services/currencyService";
import TransactionPopup from "../core/transaction_popup";
import CurrentExpensesBarChart from "../stats/currentExpensesBarChart";
import { useGlobalContext } from "../../context/GlobalContext";

const Expenses = ({ dateRange }) => {
  const global = useGlobalContext();
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState(global.expenseCategories);
  const [accounts, setAccounts] = useState(global.accounts);

  const [expenses, setExpenses] = useState(global.expenses);
  const [shownExpenses, setShownExpenses] = useState([]);
  const [transactionPopup, setTransactionPopup] = useState(false);

  useEffect(() => {
    setAccounts(global.accounts);
  }, [global.accounts]);

  useEffect(() => {
    setExpenses(global.expenses);
  }, [global.expenses]);

  useEffect(() => {
    setCategories(global.expenseCategories);
  }, [global.expenseCategories]);

  function getAccountCurrency(id) {
    const account = accounts?.filter((a) => a.id === id);
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
        categories={categories}
        expenses={expenses}
        shownExpenses={shownExpenses}
        refreshExpenses={global.updateExpenses}
        dateRange={dateRange}
        getAccountCurrency={getAccountCurrency}
      />
      {expenses == null || expenses == "undefined" || expenses?.length == 0 ? (
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
  const [totalShownExpenses, setTotalShownExpenses] = useState(0);

  useEffect(() => {
    async function getTotal() {
      let promises = props.shownExpenses?.map(async (e) => {
        return await currencyService.convert(
          props.getAccountCurrency(e.account),
          "EUR",
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
        <b>{helper.showOrMask(global.privacyMode, totalShownExpenses)}€</b>{" "}
        spent{" "}
        <small>
          from {props.dateRange?.from.toDateString()} to{" "}
          {props.dateRange?.to.toDateString()}.
        </small>
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
          account: "",
          expense_category: "",
        }}
        onSubmit={async (values, { setSubmitting, resetForm }) => {
          values["type"] = 1;
          values["tags"] = tags?.map((tag) => ({
            name: tag,
          }));
          await transactionService.addExpense(values);
          await refreshExpenses();
          await refreshAccounts();
          showToast("Expense Added", "info");
          setSubmitting(false);
          setTags([]);
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
                  {c.category}
                </option>
              ))}
            </Field>
            <button type="submit" id={"submit-button"}>
              Add Expense
            </button>
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
        ? props.expenses?.filter((e) => e.account == selectedAccount)
        : props.expenses;

    const categoryFilter =
      selectedCategory >= 0
        ? props.expenses?.filter((e) => e.expense_category == selectedCategory)
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
                {c.category}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={"expenses"}>
        {props.shownExpenses?.length > 0 &&
          props.shownExpenses?.map((expense) => (
            <ExpenseItem
              key={expense.id}
              expense={expense}
              accounts={props.accounts}
              refreshExpenses={props.refreshExpenses}
              categories={props.categories}
              currency={helper.getCurrency(
                props.getAccountCurrency(expense.account)
              )}
              setTransactionPopup={props.setTransactionPopup}
            />
          ))}
      </div>
    </div>
  );
};

const ExpenseItem = ({
  expense,
  accounts,
  categories,
  currency,
  refreshExpenses,
  setTransactionPopup,
}) => {
  const [showKebab, setShowKebab] = useState(false);
  const showConfirm = useConfirm();
  const showToast = useToast();
  const kebabMenu = useRef(null);
  const global = useGlobalContext();

  useEffect(() => {
    const handleClickOutside = (event) => {
      const kebabClicked = !!(
        event.target?.attributes?.class?.value?.includes("kebab-button") ||
        event.target?.attributes?.src?.value?.includes("kebab_icon")
      );

      if (!kebabMenu?.current?.contains(event.target) && !kebabClicked) {
        setShowKebab(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function getAccountName(id) {
    const account = accounts?.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].name;
    }
    return "Not found";
  }

  function getExpenseCategory(id) {
    const category = categories?.filter((c) => c.id === id);
    if (category?.length === 1) {
      return category[0].category;
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
    showConfirm("Delete expense?", async () => {
      const payload = {
        type: 1,
        id: expense.id,
      };
      await transactionService.deleteExpense(payload);

      showToast("Expense deleted.");
      refreshExpenses();
    });
  }

  function handleShowMore(event) {
    const kebabClicked = !!(
      event.target?.attributes?.class?.value?.includes("kebab-button") ||
      event.target?.attributes?.src?.value?.includes("kebab_icon")
    );
    const deleteButtonClicked =
      !!event.target?.attributes?.id?.value?.includes("deleteButton");

    if (!kebabClicked && !deleteButtonClicked) {
      setTransactionPopup(expense);
    }
  }

  return (
    <div className="expense-item" onClick={handleShowMore}>
      {isRecent(expense.created_on) && (
        <label className="new-transaction">NEW!</label>
      )}
      <label id="date">{expense.date}</label>
      <label id="description">{expense.description}</label>
      <label id="account">{getAccountName(expense.account)}</label>
      <label id="amount">
        {helper.showOrMask(
          global.privacyMode,
          parseFloat(expense.amount).toFixed(2)
        )}{" "}
        {currency}
      </label>
      <label id="category">
        {getExpenseCategory(expense.expense_category)}
      </label>
      <button className={"kebab-button"} onClick={toggleKebab}>
        <img src={`${process.env.PUBLIC_URL}/kebab_icon.png`} />
      </button>
      {showKebab && (
        <div
          ref={kebabMenu}
          className={"kebab-menu"}
          id={`kebab-menu-${expense.id}`}
        >
          <button onClick={handleDelete} id="deleteButton">
            Delete
          </button>
          <button onClick={handleShowMore} id="showMoreButton">
            Show more
          </button>
        </div>
      )}
    </div>
  );
};

export default Expenses;
