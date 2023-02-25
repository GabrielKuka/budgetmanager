import React, { useState, useEffect } from "react";
import transactionService from "../../services/transactionService";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Formik, Form, Field } from "formik";
import "./incomes.scss";

const Incomes = () => {
  const [incomes, setIncomes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

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
      />
      {incomes?.length > 0 && (
        <IncomesList
          incomes={incomes}
          categories={categories}
          accounts={accounts}
        />
      )}
    </div>
  );
};

const Sidebar = ({ accounts, categories, refreshIncomes }) => {
  return (
    <div className={"incomes-wrapper__sidebar"}>
      <AddIncome
        accounts={accounts}
        categories={categories}
        refreshIncomes={refreshIncomes}
      />
    </div>
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

const IncomesList = ({ accounts, categories, incomes }) => {
  const [shownIncomes = incomes, setShownIncomes] = useState();
  const [date, setDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  useEffect(filterIncomes, [date, incomes]);
  useEffect(filterIncomes, []);

  function filterIncomes() {
    const selectedAccount = document.getElementById("account").value;
    const selectedCategory = document.getElementById("category").value;
    const selectedDate = date;

    const accountFilter =
      selectedAccount >= 0
        ? incomes.filter((e) => e.account == selectedAccount)
        : incomes;

    const categoryFilter =
      selectedCategory >= 0
        ? incomes.filter((e) => e.income_category == selectedCategory)
        : incomes;

    const dateFilter = incomes.filter((e) => new Date(e.date) >= selectedDate);

    const filteredincomes = accountFilter
      .filter((e) => categoryFilter.includes(e))
      .filter((e) => dateFilter.includes(e))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
    setShownIncomes(filteredincomes);
  }

  return (
    <div className={"incomes-wrapper__incomes-list"}>
      <div className={"header"}>
        <div>
          <label>Date:</label>
          <DatePicker
            className="datepicker"
            selected={date}
            onChange={(date) => setDate(date)}
            showMonthDropdown
            dateFormat={"yyyy-MM-dd"}
          />
        </div>
        <label>Description</label>
        <div>
          <label>Account:</label>
          <select id="account" defaultValue={"-1"} onChange={filterIncomes}>
            <option value="-1">All</option>
            {accounts?.map((a) => (
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
            {categories &&
              categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.category_type}
                </option>
              ))}
          </select>
        </div>
      </div>
      <div className={"incomes"}>
        {shownIncomes?.length > 0 &&
          shownIncomes.map((income) => (
            <IncomeItem
              key={income.id}
              income={income}
              accounts={accounts}
              categories={categories}
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
