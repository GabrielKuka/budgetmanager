import { Formik, Form, Field } from "formik";
import React, { useEffect, useState } from "react";
import transactionService from "../../services/transactionService";
import "./expenses.scss";

const Expenses = () => {
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    async function getCategories() {
      const categories = await transactionService.getAllExpenseCategories();
      setCategories(categories);
    }

    async function getAccounts() {
      const accounts = await transactionService.getAllUserAccounts();
      setAccounts(accounts);
    }
    getCategories();
    getAccounts();
  }, []);

  return (
    <div className={"expenses-wrapper"}>
      <AddExpense accounts={accounts} categories={categories} />
      <div className={"expenses-list"}></div>
    </div>
  );
};

const AddExpense = ({ accounts, categories }) => {
  return (
    <div className={"expenses-wrapper__enter-expense"}>
      <Formik
        initialValues={{
          amount: "",
          date: new Date().toISOString().slice(0, 10),
        }}
        onSubmit={(values) => {
          console.log(values);
        }}
      >
        {() => (
          <Form className={"form"}>
            <label>Enter expense</label>
            <Field type="text" name="date" placeholder="Enter date" />
            <Field as="select" name="account" defaultValue="">
              <option value="" disabled hidden>
                Select account
              </option>
              {accounts &&
                accounts.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name} {parseInt(a.amount).toFixed(2)} €
                  </option>
                ))}
            </Field>
            <Field
              type="text"
              name="amount"
              placeholder="Enter amount in EUR."
            />
            <Field as="select" name="category" defaultValue="">
              <option value="" disabled hidden>
                Expense category
              </option>
              {categories &&
                categories.map((c) => (
                  <option key={c.id} value={c.category_type}>
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

export default Expenses;
