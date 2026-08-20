import React, { useState, useEffect, useRef } from "react";
import TransactionItem from "./transactionItem";
import transactionService from "../../services/transactionService/transactionService";
import "react-datepicker/dist/react-datepicker.css";
import { Formik, Form, Field } from "formik";
import "./incomes.scss";
import NoDataCard from "../core/nodata";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { helper } from "../helper";
import currencyService from "../../services/currencyService";
import TransactionPopup from "../core/transaction_popup";
import { useGlobalContext } from "../../context/GlobalContext";
import LoadingCard from "../core/LoadingCard";
import { validationSchemas } from "../../validationSchemas";
import MonthPicker from "../core/MonthPicker";
import { InsightsPanel } from "../core/workspace";
import CurrentCategoryBarChart from "../stats/currentExpensesBarChart";
import PercentExpensesPieChart from "../stats/percentExpensesPie";

const Incomes = () => {
  const global = useGlobalContext();
  const [categories, setCategories] = useState(global.incomeCategories);
  const accounts = global.activeAccounts || [];
  const accountsLoaded =
    Array.isArray(global.accounts) && Array.isArray(global.activeAccounts);

  const [shownIncomes, setShownIncomes] = useState([]);
  const [transactionPopup, setTransactionPopup] = useState(false);
  const [showDrafts, setShowDrafts] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setCategories(global.incomeCategories);
  }, [global.incomeCategories]);

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
    <div className={"incomes-wrapper"}>
      <Sidebar
        accounts={accounts}
        categories={categories}
        incomes={global.incomes}
        refreshIncomes={global.updateIncomes}
        refreshAccounts={global.updateAccounts}
        shownIncomes={shownIncomes}
        dateRange={global.dateRange}
        getAccountCurrency={getAccountCurrency}
        getTransactionCurrency={getTransactionCurrency}
      />
      <div className="incomes-wrapper__content">
        <MonthPicker
          showDrafts={showDrafts}
          setShowDrafts={setShowDrafts}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
        {!global.incomes || !accountsLoaded ? (
          <LoadingCard header="Loading Incomes..." />
        ) : global.incomes && !global.incomes?.length ? (
          <NoDataCard
            header={"No incomes found."}
            label={"Add an income."}
            focusOn={"date"}
          />
        ) : (
          <IncomesList
            incomes={global.incomes}
            shownIncomes={shownIncomes}
            setShownIncomes={setShownIncomes}
            categories={categories}
            accounts={accounts}
            dateRange={global.dateRange}
            getAccountCurrency={getAccountCurrency}
            getTransactionCurrency={getTransactionCurrency}
            refreshIncomes={global.updateIncomes}
            setTransactionPopup={setTransactionPopup}
            showDrafts={showDrafts}
            searchTerm={searchTerm}
          />
        )}
        {transactionPopup && (
          <TransactionPopup
            transaction={transactionPopup}
            type={0}
            showPopup={setTransactionPopup}
            refreshTransactions={global.updateIncomes}
            getAccountCurrency={getAccountCurrency}
            accounts={accounts}
            categories={categories}
          />
        )}
      </div>
    </div>
  );
};

const Sidebar = (props) => {
  const global = useGlobalContext();
  const [totalShownIncomes, setShownIncomes] = useState(0);
  const [incomesPerCategory, setIncomesPerCategory] = useState([]);
  const [largestIncomes, setLargestIncomes] = useState([]);
  const [prevMonthTotal, setPrevMonthTotal] = useState(null);

  useEffect(() => {
    async function getLargest() {
      const shown = (props.incomes || []).filter((e) => !e.is_draft);
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
      setLargestIncomes(sorted.slice(0, 5));
    }
    getLargest();
  }, [props.incomes, global.globalCurrency]);

  useEffect(() => {
    let active = true;
    async function getPrevMonthTotal() {
      const from = props.dateRange?.from;
      if (!from) {
        return;
      }
      const prevMonth = new Date(from.getFullYear(), from.getMonth() - 1, 1);
      const prevTo = new Date(from.getFullYear(), from.getMonth(), 0);
      const data = await transactionService.getUserIncomes(
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
    let active = true;
    const shownIncomes = (props.incomes || []).filter((e) => !e.is_draft);

    async function getTotal() {
      let promises = shownIncomes.map(async (e) => {
        return await currencyService.convert(
          props.getTransactionCurrency(e),
          global.globalCurrency,
          e.amount
        );
      });

      const results = await Promise.all(promises);
      if (!active) {
        return;
      }
      let total = results.reduce((acc, curr) => acc + parseFloat(curr), 0);

      setShownIncomes(parseFloat(total).toFixed(2));
    }

    async function getIncomesPerCategory() {
      if (!props.categories) {
        setIncomesPerCategory([]);
        return;
      }
      const data = [];
      for (const c of props.categories) {
        let promises = shownIncomes
          .filter((e) => e.category == c.id)
          .map(async (e) => {
            return await currencyService.convert(
              props.getTransactionCurrency(e),
              global.globalCurrency,
              e.amount
            );
          });
        if (promises && promises.length > 0) {
          const results = await Promise.all(promises);
          const total = results.reduce((t, curr) => (t += parseFloat(curr)), 0);
          data.push({
            category: c.category,
            amount: parseFloat(parseFloat(total).toFixed(2)),
          });
        }
      }

      if (active) {
        setIncomesPerCategory(data);
      }
    }

    getIncomesPerCategory();
    getTotal();
    return () => {
      active = false;
    };
  }, [props.incomes, props.categories, global.globalCurrency]);

  return (
    <InsightsPanel className="incomes-wrapper__sidebar" title="Income insights">
      <div className={"summary"}>
        <b>
          {helper.showOrMask(
            global.privacyMode,
            helper.formatNumber(totalShownIncomes)
          )}
          {helper.getCurrency(global.globalCurrency)}
        </b>{" "}
        earned{" "}
        <small>
          from {props.dateRange.from.toDateString()} to{" "}
          {props.dateRange.to.toDateString()}.
        </small>
      </div>
      {prevMonthTotal !== null &&
        (() => {
          const diff =
            parseFloat(totalShownIncomes) - parseFloat(prevMonthTotal);
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
      <CurrentCategoryBarChart data={incomesPerCategory} />
      {largestIncomes.length > 0 && (
        <div className="largest-list-card">
          <div className="chart-title">Largest incomes</div>
          <ol className="largest-list">
            {largestIncomes.map((e, idx) => (
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
          expenses={(props.incomes || []).filter((e) => !e.is_draft)}
          categories={props.categories}
          getAccountCurrency={props.getAccountCurrency}
          getTransactionCurrency={props.getTransactionCurrency}
          accountField="to_account"
          width={330}
          height={250}
          outerRadius="72%"
        />
      </div>
    </InsightsPanel>
  );
};

const AddIncome = ({
  accounts,
  categories,
  refreshIncomes,
  refreshAccounts,
  getAccountCurrency,
}) => {
  const showToast = useToast();
  const [tags, setTags] = useState([]);
  const [addingIncome, setAddingIncome] = useState(false);

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
    <div className={"enter-income"}>
      <Formik
        initialValues={{
          amount: "",
          to_account: "",
          description: "",
          category: "",
          date: new Date().toISOString().slice(0, 10),
        }}
        validationSchema={validationSchemas.incomeFormSchema}
        validateOnChange={false}
        validateOnBlur={false}
        onSubmit={(values, { resetForm, setSubmitting, validateForm }) => {
          validateForm().then(async () => {
            setAddingIncome(true);
            values["type"] = 0;
            values["tags"] = tags.map((tag) => ({
              name: tag,
            }));
            await transactionService.addIncome(values);
            await refreshIncomes();
            await refreshAccounts();
            showToast("Income Added", "info");
            setSubmitting(false);
            setTags([]);
            resetForm();
            setAddingIncome(false);
          });
        }}
      >
        {({ errors, touched }) => (
          <Form className={"form"}>
            <label onClick={() => document.getElementById("date").focus()}>
              Enter Income
            </label>
            <Field type="text" id="date" name="date" placeholder="Enter date" />
            <Field as="select" name="to_account">
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
                  {tags.map((t) => (
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
                Income category
              </option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.category}
                </option>
              ))}
            </Field>
            <div id={"submit_wrapper"}>
              <button type="submit" id="submit-button">
                Add Income
              </button>
              {addingIncome && (
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
            {errors.income_category && touched.income_category ? (
              <span>{errors.income_category}</span>
            ) : null}
          </Form>
        )}
      </Formik>
    </div>
  );
};

const IncomesList = (props) => {
  const global = useGlobalContext();
  const [sortedBy, setSortedBy] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionActive, setSelectionActive] = useState(false);
  const [selectedSum, setSelectedSum] = useState(0);
  const showToast = useToast();
  const showConfirm = useConfirm();
  const listRef = useRef(null);
  useEffect(filterIncomes, [
    props.dateRange,
    props.incomes,
    props.showDrafts,
    props.searchTerm,
  ]);
  useEffect(filterIncomes, []);

  useEffect(() => {
    let active = true;
    async function computeSelectedSum() {
      if (selectedIds.length === 0) {
        setSelectedSum(0);
        return;
      }
      const selected = (props.shownIncomes || []).filter((e) =>
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
  }, [selectedIds, props.shownIncomes, global.globalCurrency]);

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

  function matchesSearch(income) {
    const term = (props.searchTerm || "").trim().toLowerCase();
    if (!term) {
      return true;
    }
    const categoryName =
      props.categories?.find((c) => c.id === income.category)?.category || "";
    const accountName =
      props.accounts?.find((a) => a.id === income.to_account)?.name || "";
    const tags = (income.tags || []).map((t) => t.name).join(" ");
    return [
      String(income.description || ""),
      String(income.amount),
      categoryName,
      accountName,
      tags,
    ].some((v) => v.toLowerCase().includes(term));
  }

  function filterIncomes() {
    const selectedAccount = document.getElementById("account").value;
    const selectedCategory = document.getElementById("category").value;

    const fromDate = props.dateRange.from;
    const toDate = props.dateRange.to;

    const accountFilter =
      selectedAccount >= 0
        ? props.incomes?.filter((e) => e.to_account == selectedAccount)
        : props.incomes;

    const categoryFilter =
      selectedCategory >= 0
        ? props.incomes?.filter((e) => e.category == selectedCategory)
        : props.incomes;

    const fmtDate = (d) =>
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0");

    const dateFilter = props.incomes?.filter(
      (e) => e.date >= fmtDate(fromDate) && e.date <= fmtDate(toDate)
    );

    let filteredincomes = accountFilter
      ?.filter((e) => categoryFilter.includes(e))
      ?.filter((e) => dateFilter.includes(e))
      ?.filter((e) => props.showDrafts || !e.is_draft)
      ?.filter((e) => matchesSearch(e))
      ?.sort((a, b) => (a.date > b.date ? -1 : 1));
    // Pinned transactions always first
    filteredincomes?.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    props.setShownIncomes(filteredincomes);
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
      `Delete ${selectedIds.length} income(s)? This cannot be undone.`,
      async () => {
        for (const id of selectedIds) {
          const income = props.shownIncomes.find((e) => e.id === id);
          if (!income) {
            continue;
          }
          await transactionService.deleteIncome({
            type: 0,
            id: income.id,
          });
        }
        setSelectedIds([]);
        setSelectionActive(false);
        showToast(`${selectedIds.length} income(s) deleted.`);
        await props.refreshIncomes();
      }
    );
  }

  async function sortShownIncomes(by = "") {
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
      props.shownIncomes.map(async (item) => ({
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
    props.setShownIncomes(sorted);
  }

  return (
    <div ref={listRef} className={"incomes-wrapper__incomes-list"}>
      <div className={"header"}>
        <div>
          <label onClick={() => sortShownIncomes("date")}>Date:</label>
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
          <label onClick={() => sortShownIncomes("account")}>Account:</label>
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
          <select id="account" defaultValue={"-1"} onChange={filterIncomes}>
            <option value="-1">All</option>
            {props.accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label onClick={() => sortShownIncomes("amount")}>Amount</label>
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
          <label onClick={() => sortShownIncomes("income_category")}>
            Category:
          </label>
          {sortedBy["income_category"] == "ascending" && (
            <img
              src={`${process.env.PUBLIC_URL}/up_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
          {sortedBy["income_category"] == "descending" && (
            <img
              src={`${process.env.PUBLIC_URL}/down_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
          <select id="category" defaultValue="-1" onChange={filterIncomes}>
            <option value="-1">All</option>
            {props.categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.category}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={"incomes"}>
        {props.shownIncomes?.length > 0 &&
          props.shownIncomes.map((income) => (
            <TransactionItem
              key={income.id}
              transaction={income}
              refreshTransactions={props.refreshIncomes}
              categories={props.categories}
              currency={helper.getCurrency(
                props.getTransactionCurrency(income)
              )}
              setTransactionPopup={props.setTransactionPopup}
              refreshAccounts={global.updateAccounts}
              selectionActive={selectionActive}
              selected={selectedIds.includes(income.id)}
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

export default Incomes;
