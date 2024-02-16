import React, { useState, useEffect, useRef } from "react";
import transactionService from "../../services/transactionService/transactionService";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Formik, Form, Field } from "formik";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";
import "./incomes.scss";
import NoDataCard from "../core/nodata";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { helper } from "../helper";
import currencyService from "../../services/currencyService";
import TransactionPopup from "../core/transaction_popup";

const Incomes = ({ dateRange }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [incomes, setIncomes] = useState([]);
  const [shownIncomes = incomes, setShownIncomes] = useState();
  const [transactionPopup, setTransactionPopup] = useState(false);

  useEffect(() => {
    getAccounts();
    getCategories();
    getIncomes();
  }, []);

  async function getAccounts() {
    const accounts = await transactionService.getAllUserAccounts();
    setAccounts(accounts);
  }
  async function getCategories() {
    const categories = await transactionService.getAllIncomeCategories();
    setCategories(categories);
  }
  async function getIncomes() {
    const incomes = await transactionService
      .getAllUserIncomes()
      .finally(() => setIsLoading(false));
    setIncomes(incomes);
  }

  function getAccountCurrency(id) {
    const account = accounts.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  return (
    <div className={"incomes-wrapper"}>
      <Sidebar
        accounts={accounts}
        categories={categories}
        refreshIncomes={getIncomes}
        refreshAccounts={getAccounts}
        shownIncomes={shownIncomes}
        dateRange={dateRange}
        getAccountCurrency={getAccountCurrency}
      />
      {!isLoading && (
        <>
          {!incomes.length ? (
            <NoDataCard
              header={"No incomes found."}
              label={"Add an income."}
              focusOn={"date"}
            />
          ) : (
            <IncomesList
              incomes={incomes}
              shownIncomes={shownIncomes}
              setShownIncomes={setShownIncomes}
              categories={categories}
              accounts={accounts}
              dateRange={dateRange}
              getAccountCurrency={getAccountCurrency}
              refreshIncomes={getIncomes}
              setTransactionPopup={setTransactionPopup}
            />
          )}
        </>
      )}
      {transactionPopup && (
        <TransactionPopup
          transaction={transactionPopup}
          type={0}
          showPopup={setTransactionPopup}
          refreshTransactions={getIncomes}
          getAccountCurrency={getAccountCurrency}
          accounts={accounts}
          categories={categories}
        />
      )}
    </div>
  );
};

const Sidebar = (props) => {
  const [totalShownIncomes, setShownIncomes] = useState(0);
  const [incomesPerCategory, setIncomesPerCategory] = useState("");

  useEffect(() => {
    async function getTotal() {
      let promises = props.shownIncomes.map(async (e) => {
        return await currencyService.convert(
          props.getAccountCurrency(e.account),
          "EUR",
          e.amount
        );
      });

      const results = await Promise.all(promises);
      let total = results.reduce((acc, curr) => acc + parseFloat(curr), 0);

      setShownIncomes(parseFloat(total).toFixed(2));
    }

    async function getIncomesPerCategory() {
      const data = [];
      for (const c of props.categories) {
        let promises = props.shownIncomes
          .filter((e) => e.income_category == c.id)
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

      setIncomesPerCategory(data);
    }

    getIncomesPerCategory();
    getTotal();
  }, [props.shownIncomes]);

  return (
    <div className={"incomes-wrapper__sidebar"}>
      <AddIncome
        accounts={props.accounts}
        categories={props.categories}
        refreshIncomes={props.refreshIncomes}
        refreshAccounts={props.refreshAccounts}
        getAccountCurrency={props.getAccountCurrency}
      />
      <div className={"summary"}>
        <b>{totalShownIncomes}€</b> earned{" "}
        <small>
          from {props.dateRange.from.toDateString()} to{" "}
          {props.dateRange.to.toDateString()}.
        </small>
      </div>
      <Chart data={incomesPerCategory} />
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

const AddIncome = ({
  accounts,
  categories,
  refreshIncomes,
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
    <div className={"enter-income"}>
      <Formik
        initialValues={{
          amount: "",
          account: "",
          description: "",
          income_category: "",
          date: new Date().toISOString().slice(0, 10),
        }}
        onSubmit={async (values, { resetForm, setSubmitting }) => {
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
        }}
      >
        {() => (
          <Form className={"form"}>
            <label onClick={() => document.getElementById("date").focus()}>
              Enter Income
            </label>
            <Field type="text" id="date" name="date" placeholder="Eter date" />
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
                        onClick={() => setTags(tags.filter((tag) => tag !== t))}
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
            <Field as="select" name="income_category">
              <option value="" disabled hidden>
                Income category
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

const IncomesList = (props) => {
  const [sortedBy, setSortedBy] = useState({});
  useEffect(filterIncomes, [props.dateRange, props.incomes]);
  useEffect(filterIncomes, []);

  function filterIncomes() {
    const selectedAccount = document.getElementById("account").value;
    const selectedCategory = document.getElementById("category").value;

    const fromDate = props.dateRange.from;
    const toDate = props.dateRange.to;

    const accountFilter =
      selectedAccount >= 0
        ? props.incomes.filter((e) => e.account == selectedAccount)
        : props.incomes;

    const categoryFilter =
      selectedCategory >= 0
        ? props.incomes.filter((e) => e.income_category == selectedCategory)
        : props.incomes;

    const dateFilter = props.incomes.filter(
      (e) => new Date(e.date) >= fromDate && new Date(e.date) <= toDate
    );

    const filteredincomes = accountFilter
      .filter((e) => categoryFilter.includes(e))
      .filter((e) => dateFilter.includes(e))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
    props.setShownIncomes(filteredincomes);
  }

  function sortShownIncomes(by = "") {
    if (!by) {
      return;
    }

    let sorted = null;

    if (by == "date") {
      if ("date" in sortedBy) {
        if (sortedBy["date"] == "ascending") {
          sorted = [...props.shownIncomes].sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          );
          setSortedBy({ date: "descending" });
        } else {
          sorted = [...props.shownIncomes].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
          );
          setSortedBy({ date: "ascending" });
        }
      } else {
        sorted = [...props.shownIncomes].sort(
          (a, b) => new Date(a.date) - new Date(b.date)
        );
        setSortedBy({ date: "ascending" });
      }
      props.setShownIncomes(sorted);
      return;
    }

    if (`${by}` in sortedBy) {
      if (sortedBy[`${by}`] == "ascending") {
        sorted = [...props.shownIncomes].sort(
          (a, b) => b[`${by}`] - a[`${by}`]
        );
        setSortedBy({ [by]: "descending" });
      } else {
        sorted = [...props.shownIncomes].sort(
          (a, b) => a[`${by}`] - b[`${by}`]
        );
        setSortedBy({ [by]: "ascending" });
      }
    } else {
      sorted = [...props.shownIncomes].sort((a, b) => a[`${by}`] - b[`${by}`]);
      setSortedBy({ [by]: "ascending" });
    }
    props.setShownIncomes(sorted);
  }

  return (
    <div className={"incomes-wrapper__incomes-list"}>
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
                {c.category_type}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={"incomes"}>
        {props.shownIncomes?.length > 0 &&
          props.shownIncomes.map((income) => (
            <IncomeItem
              key={income.id}
              income={income}
              accounts={props.accounts}
              categories={props.categories}
              currency={helper.getCurrency(
                props.getAccountCurrency(income.account)
              )}
              refreshIncomes={props.refreshIncomes}
              setTransactionPopup={props.setTransactionPopup}
            />
          ))}
      </div>
    </div>
  );
};

const IncomeItem = ({
  income,
  accounts,
  categories,
  currency,
  refreshIncomes,
  setTransactionPopup,
}) => {
  const [showKebab, setShowKebab] = useState(false);
  const showConfirm = useConfirm();
  const showToast = useToast();
  const kebabMenu = useRef(null);

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

  function toggleKebab() {
    setShowKebab((prevState) => !prevState);
  }

  function handleDelete() {
    showConfirm("Delete income?", async () => {
      const payload = {
        type: 0,
        id: income.id,
      };
      await transactionService.deleteIncome(payload);

      showToast("Income deleted.");
      refreshIncomes();
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
      setTransactionPopup(income);
    }
  }

  return (
    <div className="income-item" onClick={handleShowMore}>
      {isRecent(income.created_on) && (
        <label className="new-transaction">NEW!</label>
      )}
      <label id="date">{income.date}</label>
      <label id="description">{income.description}</label>
      <label id="account">{getAccountName(income.account)}</label>
      <label id="amount">
        {parseFloat(income.amount).toFixed(2)} {currency}
      </label>
      <label id="category">{getIncomeCategory(income.income_category)}</label>
      <button className={"kebab-button"} onClick={toggleKebab}>
        <img src={`${process.env.PUBLIC_URL}/kebab_icon.png`} />
      </button>
      {showKebab && (
        <div
          ref={kebabMenu}
          className={"kebab-menu"}
          id={`kebab-menu-${income.id}`}
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

export default Incomes;
