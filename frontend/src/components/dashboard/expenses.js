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
import PercentExpensesPieChart from "../stats/percentExpensesPie";
import { useGlobalContext } from "../../context/GlobalContext";
import LoadingCard from "../core/LoadingCard";
import { validationSchemas } from "../../validationSchemas";
import TransactionItem from "./transactionItem";
import MonthPicker from "../core/MonthPicker";

const Expenses = () => {
  const global = useGlobalContext();
  const accounts = global.activeAccounts || [];
  const accountsLoaded =
    Array.isArray(global.accounts) && Array.isArray(global.activeAccounts);

  const [shownExpenses, setShownExpenses] = useState([]);
  const [transactionPopup, setTransactionPopup] = useState(false);
  const [showDrafts, setShowDrafts] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  function getAccountCurrency(id) {
    const account = global.accounts?.find((a) => Number(a.id) === Number(id));
    if (account) {
      return account.currency;
    }

    return accountsLoaded ? "Not Found" : null;
  }

  function getTransactionCurrency(transaction) {
    return helper.getTransactionCurrency(
      global.accounts,
      transaction,
      getAccountCurrency
    );
  }

  return (
    <div className={"expenses-wrapper"}>
      <Sidebar
        accounts={accounts}
        refreshAccounts={global.updateAccounts}
        categories={global.expenseCategories}
        expenses={global.expenses}
        shownExpenses={shownExpenses}
        refreshExpenses={global.updateExpenses}
        dateRange={global.dateRange}
        getAccountCurrency={getAccountCurrency}
        getTransactionCurrency={getTransactionCurrency}
      />
      <div className="expenses-wrapper__content">
        <MonthPicker
          showDrafts={showDrafts}
          setShowDrafts={setShowDrafts}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
        {!global.expenses || !accountsLoaded ? (
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
            getTransactionCurrency={getTransactionCurrency}
            refreshExpenses={global.updateExpenses}
            setTransactionPopup={setTransactionPopup}
            showDrafts={showDrafts}
            setShowDrafts={setShowDrafts}
            searchTerm={searchTerm}
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
    </div>
  );
};

const Sidebar = (props) => {
  const global = useGlobalContext();
  const [totalShownExpenses, setTotalShownExpenses] = useState(false);
  const [shownExpenseRate, setShownExpenseRate] = useState(false);
  const [largestExpenses, setLargestExpenses] = useState([]);
  const [prevMonthTotal, setPrevMonthTotal] = useState(null);

  useEffect(() => {
    async function getLargest() {
      const shown = (props.expenses || []).filter((e) => !e.is_draft);
      const withConverted = await Promise.all(
        shown.map(async (e) => ({
          ...e,
          converted: parseFloat(
            await currencyService.convert(
              props.getTransactionCurrency(e),
              global.globalCurrency,
              e.amount
            )
          ),
        }))
      );
      const sorted = withConverted.sort((a, b) => b.converted - a.converted);
      setLargestExpenses(sorted.slice(0, 5));
    }
    getLargest();
  }, [props.expenses, global.globalCurrency]);

  useEffect(() => {
    let active = true;
    async function getPrevMonthTotal() {
      const from = props.dateRange?.from;
      if (!from) {
        return;
      }
      const prevMonth = new Date(from.getFullYear(), from.getMonth() - 1, 1);
      const prevTo = new Date(from.getFullYear(), from.getMonth(), 0);
      const data = await transactionService.getUserExpenses(
        { from: prevMonth, to: prevTo },
        false,
        global.globalCurrency
      );
      if (!active) {
        return;
      }
      const total = (data || []).reduce(
        (acc, e) => acc + parseFloat(e.converted_amount || 0),
        0
      );
      setPrevMonthTotal(parseFloat(total).toFixed(2));
    }
    getPrevMonthTotal();
    return () => {
      active = false;
    };
  }, [props.dateRange, global.globalCurrency]);

  useEffect(() => {
    async function getTotal() {
      const periodExpenses = (props.expenses || []).filter((e) => !e.is_draft);
      let promises = periodExpenses?.map(async (e) => {
        return await currencyService.convert(
          props.getTransactionCurrency(e),
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
  }, [props.expenses, global.globalCurrency]);

  useEffect(() => {
    async function getExpenseRate() {
      if (totalShownExpenses) {
        if (!global.incomes) {
          return;
        }
        const fmtDate = (d) =>
          d.getFullYear() +
          "-" +
          String(d.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(d.getDate()).padStart(2, "0");

        let filteredincomes = global.incomes?.filter(
          (i) =>
            i.date >= fmtDate(props.dateRange.from) &&
            i.date <= fmtDate(props.dateRange.to)
        );
        let promises = filteredincomes?.map(async (e) => {
          return await currencyService.convert(
            helper.getTransactionCurrency(
              global.accounts,
              e,
              props.getAccountCurrency
            ),
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
      {prevMonthTotal !== null &&
        totalShownExpenses !== false &&
        (() => {
          const diff =
            parseFloat(totalShownExpenses) - parseFloat(prevMonthTotal);
          const sign = diff >= 0 ? "+" : "-";
          const word = diff >= 0 ? "more than" : "less than";
          const pct =
            prevMonthTotal > 0
              ? sign +
                Math.abs((diff / parseFloat(prevMonthTotal)) * 100).toFixed(1)
              : "0.0";
          return (
            <div className="mom-compare">
              <span>
                {helper.showOrMask(
                  global.privacyMode,
                  helper.formatNumber(Math.abs(diff).toFixed(2))
                )}
                {helper.getCurrency(global.globalCurrency)} {word} last month{" "}
                <strong>({pct}%)</strong>
              </span>
            </div>
          );
        })()}
      <CurrentExpensesBarChart
        expenses={(props.expenses || []).filter((e) => !e.is_draft)}
        categories={props.categories}
        getAccountCurrency={props.getAccountCurrency}
        getTransactionCurrency={props.getTransactionCurrency}
        width={330}
        height={250}
      />
      {largestExpenses.length > 0 && (
        <div className="largest-list-card">
          <div className="chart-title">Largest expenses</div>
          <ol className="largest-list">
            {largestExpenses.map((e, idx) => (
              <li key={e.id} className="largest-list__item">
                <span className="largest-list__rank">{idx + 1}</span>
                <span className="largest-list__desc">
                  {e.description
                    ? e.description
                    : props.categories?.find((c) => c.id === e.category)
                        ?.category || "—"}
                </span>
                <span className="largest-list__amount">
                  {helper.showOrMask(
                    global.privacyMode,
                    helper.formatNumber(e.amount)
                  )}
                  {helper.getCurrency(props.getTransactionCurrency(e))}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="pie-chart-card">
        <div className="chart-title">By category</div>
        <PercentExpensesPieChart
          expenses={(props.expenses || []).filter((e) => !e.is_draft)}
          categories={props.categories}
          getAccountCurrency={props.getAccountCurrency}
          getTransactionCurrency={props.getTransactionCurrency}
          width={330}
          height={250}
          outerRadius={112}
        />
      </div>
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
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionActive, setSelectionActive] = useState(false);
  const [selectedSum, setSelectedSum] = useState(0);
  const showToast = useToast();
  const showConfirm = useConfirm();
  const listRef = useRef(null);
  useEffect(filterExpenses, []);
  useEffect(filterExpenses, [
    props.dateRange,
    props.expenses,
    props.showDrafts,
    props.searchTerm,
  ]);
  const global = useGlobalContext();

  useEffect(() => {
    let active = true;
    async function computeSelectedSum() {
      if (selectedIds.length === 0) {
        setSelectedSum(0);
        return;
      }
      const selected = (props.shownExpenses || []).filter((e) =>
        selectedIds.includes(e.id)
      );
      const converted = await Promise.all(
        selected.map(async (e) =>
          parseFloat(
            await currencyService.convert(
              props.getTransactionCurrency(e),
              global.globalCurrency,
              e.amount
            )
          )
        )
      );
      if (active) {
        setSelectedSum(
          parseFloat(converted.reduce((a, b) => a + b, 0).toFixed(2))
        );
      }
    }
    computeSelectedSum();
    return () => {
      active = false;
    };
  }, [selectedIds, props.shownExpenses, global.globalCurrency]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (selectionActive && !listRef.current?.contains(event.target)) {
        setSelectionActive(false);
        setSelectedIds([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [selectionActive]);

  function matchesSearch(expense) {
    const term = (props.searchTerm || "").trim().toLowerCase();
    if (!term) {
      return true;
    }
    const categoryName =
      props.categories?.find((c) => c.id === expense.category)?.category || "";
    const accountName =
      props.accounts?.find((a) => a.id === expense.from_account)?.name || "";
    const tags = (expense.tags || []).map((t) => t.name).join(" ");
    return [
      String(expense.description || ""),
      String(expense.amount),
      categoryName,
      accountName,
      tags,
    ].some((v) => v.toLowerCase().includes(term));
  }

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

    const fmtDate = (d) =>
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0");

    const dateFilter = props.expenses?.filter(
      (e) => e.date >= fmtDate(fromDate) && e.date <= fmtDate(toDate)
    );

    let filteredExpenses = accountFilter
      ?.filter((e) => categoryFilter.includes(e))
      ?.filter((e) => dateFilter.includes(e))
      ?.filter((e) => props.showDrafts || !e.is_draft)
      ?.filter((e) => matchesSearch(e))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
    // Pinned transactions always first
    filteredExpenses?.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    props.setShownExpenses(filteredExpenses);
  }

  function handleLongPress(id) {
    setSelectionActive(true);
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function toggleSelect(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleBulkDelete() {
    showConfirm(
      `Delete ${selectedIds.length} expense(s)? This cannot be undone.`,
      async () => {
        for (const id of selectedIds) {
          const expense = props.shownExpenses.find((e) => e.id === id);
          if (!expense) {
            continue;
          }
          await transactionService.deleteExpense({
            type: 1,
            id: expense.id,
          });
        }
        setSelectedIds([]);
        setSelectionActive(false);
        showToast(`${selectedIds.length} expense(s) deleted.`);
        await props.refreshExpenses();
      }
    );
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
          props.getTransactionCurrency(item),
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
    // Pinned transactions always first
    sorted?.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    props.setShownExpenses(sorted);
  }

  return (
    <div ref={listRef} className={"expenses-wrapper__expenses-list"}>
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
            <TransactionItem
              key={expense.id}
              transaction={expense}
              refreshTransactions={props.refreshExpenses}
              categories={props.categories}
              currency={helper.getCurrency(
                props.getTransactionCurrency(expense)
              )}
              setTransactionPopup={props.setTransactionPopup}
              refreshAccounts={global.updateAccounts}
              selectionActive={selectionActive}
              selected={selectedIds.includes(expense.id)}
              onLongPress={handleLongPress}
              onToggleSelect={toggleSelect}
            />
          ))}
      </div>
      {selectionActive && selectedIds.length > 0 && (
        <div className={"bulk-action-bar"}>
          <span className={"bulk-action-bar__count"}>
            {selectedIds.length} selected ·{" "}
            {helper.showOrMask(
              global.privacyMode,
              helper.formatNumber(selectedSum)
            )}
            {helper.getCurrency(global.globalCurrency)}
          </span>
          <button
            className={"bulk-action-bar__delete"}
            onClick={handleBulkDelete}
          >
            Delete
          </button>
          <button
            className={"bulk-action-bar__clear"}
            onClick={() => {
              setSelectedIds([]);
              setSelectionActive(false);
            }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

export default Expenses;
