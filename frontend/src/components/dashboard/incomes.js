import React, { useState, useEffect } from "react";
import transactionService from "../../services/transactionService";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Formik, Form, Field } from "formik";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";
import "./incomes.scss";

const Incomes = () => {
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [incomes, setIncomes] = useState([]);
  const [shownIncomes = incomes, setShownIncomes] = useState();
  const [date, setDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

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
    const incomes = await transactionService.getAllUserIncomes();
    setIncomes(incomes);
  }

  return (
    <div className={"incomes-wrapper"}>
      <Sidebar
        accounts={accounts}
        categories={categories}
        refreshIncomes={getIncomes}
        shownIncomes={shownIncomes}
        date={date}
      />
      {incomes?.length > 0 && (
        <IncomesList
          incomes={incomes}
          shownIncomes={shownIncomes}
          setShownIncomes={setShownIncomes}
          categories={categories}
          accounts={accounts}
          date={date}
          setDate={setDate}
        />
      )}
    </div>
  );
};

const Sidebar = (props) => {
  function getIncomesPerCategory() {
    const data = [];

    props.categories.forEach((c) => {
      let result = props.shownIncomes
        .filter((e) => e.income_category == c.id)
        .reduce((t, obj) => (t += parseFloat(obj.amount)), 0)
        .toFixed(2);
      data.push({
        category: c.category_type,
        amount: result,
      });
    });

    return data;
  }

  return (
    <div className={"incomes-wrapper__sidebar"}>
      <AddIncome
        accounts={props.accounts}
        categories={props.categories}
        refreshIncomes={props.refreshIncomes}
      />
      <Chart data={getIncomesPerCategory()} />
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

const AddIncome = ({ accounts, categories, refreshIncomes }) => {
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
          console.log(values);
          await transactionService.addIncome(values);
          await refreshIncomes();
          setSubmitting(false);
          resetForm();
        }}
      >
        {() => (
          <Form className={"form"}>
            <label>Enter Income</label>
            <Field type="text" name="date" placeholder="Enter date" />
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
            <Field as="select" name="income_category">
              <option value="" disabled hidden>
                Income category
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

const IncomesList = (props) => {
  useEffect(filterIncomes, [props.date]);
  useEffect(filterIncomes, []);

  function filterIncomes() {
    const selectedAccount = document.getElementById("account").value;
    const selectedCategory = document.getElementById("category").value;
    const selectedDate = props.date;

    const accountFilter =
      selectedAccount >= 0
        ? props.incomes.filter((e) => e.account == selectedAccount)
        : props.incomes;

    const categoryFilter =
      selectedCategory >= 0
        ? props.incomes.filter((e) => e.income_category == selectedCategory)
        : props.incomes;

    const dateFilter = props.incomes.filter(
      (e) => new Date(e.date) >= selectedDate
    );

    const filteredincomes = accountFilter
      .filter((e) => categoryFilter.includes(e))
      .filter((e) => dateFilter.includes(e))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
    props.setShownIncomes(filteredincomes);
  }

  return (
    <div className={"incomes-wrapper__incomes-list"}>
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
          <select id="account" defaultValue={"-1"} onChange={filterIncomes}>
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
          <select id="category" defaultValue="-1" onChange={filterIncomes}>
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
      <div className={"incomes"}>
        {props.shownIncomes?.length > 0 &&
          props.shownIncomes.map((income) => (
            <IncomeItem
              key={income.id}
              income={income}
              accounts={props.accounts}
              categories={props.categories}
            />
          ))}
      </div>
    </div>
  );
};

const IncomeItem = ({ income, accounts, categories }) => {
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

  return (
    <div className="income-item">
      <label id="date">{income.date}</label>
      <label id="description">{income.description}</label>
      <label id="account">{getAccountName(income.account)}</label>
      <label id="amount">{parseFloat(income.amount).toFixed(2)} €</label>
      <label id="category">{getIncomeCategory(income.income_category)}</label>
    </div>
  );
};

export default Incomes;
