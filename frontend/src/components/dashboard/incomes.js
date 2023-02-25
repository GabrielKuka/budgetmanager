import React, { useState, useEffect } from "react";
import transactionService from "../../services/transactionService";
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
      {incomes?.length > 0 && <IncomesList />}
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
          console.log(values);
          refreshIncomes();
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

const IncomesList = () => {
  return <div className={"incomes-wrapper__incomes-list"}>Incomes list</div>;
};

export default Incomes;
