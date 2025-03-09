import React, { useState, useEffect } from "react";
import TransactionItem from "./transactionItem";
import transactionService from "../../services/transactionService/transactionService";
import "react-datepicker/dist/react-datepicker.css";
import { Formik, Form, Field } from "formik";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";
import "./incomes.scss";
import NoDataCard from "../core/nodata";
import { useToast } from "../../context/ToastContext";
import { helper } from "../helper";
import currencyService from "../../services/currencyService";
import TransactionPopup from "../core/transaction_popup";
import { useGlobalContext } from "../../context/GlobalContext";
import LoadingCard from "../core/LoadingCard";
import { validationSchemas } from "../../validationSchemas";
import BarChartToolTip from "../stats/barChartTooltip";

const Incomes = () => {
  const global = useGlobalContext();
  const [categories, setCategories] = useState(global.incomeCategories);
  const [accounts, setAccounts] = useState(global.activeAccounts);

  const [shownIncomes = global.incomes, setShownIncomes] = useState();
  const [transactionPopup, setTransactionPopup] = useState(false);

  useEffect(() => {
    setAccounts(global.activeAccounts);
  }, [global.activeAcounts]);

  useEffect(() => {
    setCategories(global.incomeCategories);
  }, [global.incomeCategories]);

  function getAccountCurrency(id) {
    const account = global.accounts?.filter((a) => a.id === id);
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
        refreshIncomes={global.updateIncomes}
        refreshAccounts={global.updateAccounts}
        shownIncomes={shownIncomes}
        dateRange={global.dateRange}
        getAccountCurrency={getAccountCurrency}
      />
      {!global.incomes ? (
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
          refreshIncomes={global.updateIncomes}
          setTransactionPopup={setTransactionPopup}
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
  );
};

const Sidebar = (props) => {
  const global = useGlobalContext();
  const [totalShownIncomes, setShownIncomes] = useState(0);
  const [incomesPerCategory, setIncomesPerCategory] = useState("");

  useEffect(() => {
    async function getTotal() {
      if (!props.shownIncomes) {
        return;
      }
      let promises = props.shownIncomes?.map(async (e) => {
        return await currencyService.convert(
          props.getAccountCurrency(e.account),
          global.globalCurrency,
          e.amount
        );
      });

      const results = await Promise.all(promises);
      let total = results.reduce((acc, curr) => acc + parseFloat(curr), 0);

      setShownIncomes(parseFloat(total).toFixed(2));
    }

    async function getIncomesPerCategory() {
      if (!props.categories) {
        return;
      }
      const data = [];
      for (const c of props.categories) {
        let promises = props.shownIncomes
          ?.filter((e) => e.income_category == c.id)
          ?.map(async (e) => {
            return await currencyService.convert(
              props.getAccountCurrency(e?.account),
              global.globalCurrency,
              e.amount
            );
          });
        if (promises && promises.length > 0) {
          const results = await Promise.all(promises);
          const total = results.reduce((t, curr) => (t += parseFloat(curr)), 0);
          data.push({
            category: c.category,
            amount: parseFloat(total).toFixed(2),
          });
        }
      }

      setIncomesPerCategory(data);
    }

    getIncomesPerCategory();
    getTotal();
  }, [props.shownIncomes, global.globalCurrency]);

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
      <Tooltip
        content={<BarChartToolTip />}
        wrapperStyle={{ border: "none" }}
      />
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
          account: "",
          description: "",
          income_category: "",
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
            <Field as="select" name="income_category">
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
  useEffect(filterIncomes, [props.dateRange, props.incomes]);
  useEffect(filterIncomes, []);

  function filterIncomes() {
    const selectedAccount = document.getElementById("account").value;
    const selectedCategory = document.getElementById("category").value;

    const fromDate = props.dateRange.from;
    const toDate = props.dateRange.to;

    const accountFilter =
      selectedAccount >= 0
        ? props.incomes?.filter((e) => e.account == selectedAccount)
        : props.incomes;

    const categoryFilter =
      selectedCategory >= 0
        ? props.incomes?.filter((e) => e.income_category == selectedCategory)
        : props.incomes;

    const dateFilter = props.incomes?.filter(
      (e) => new Date(e.date) >= fromDate && new Date(e.date) <= toDate
    );

    const filteredincomes = accountFilter
      ?.filter((e) => categoryFilter.includes(e))
      ?.filter((e) => dateFilter.includes(e))
      ?.sort((a, b) => (a.date > b.date ? -1 : 1));
    props.setShownIncomes(filteredincomes);
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
            {global.accounts?.map((a) => (
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
              refreshTransactions={props.refreshExpenses}
              categories={props.categories}
              currency={helper.getCurrency(
                props.getAccountCurrency(income.account)
              )}
              setTransactionPopup={props.setTransactionPopup}
              refreshAccounts={global.updateAccounts}
            />
          ))}
      </div>
    </div>
  );
};

export default Incomes;
