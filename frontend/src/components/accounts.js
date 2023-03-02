import { React, useState, useEffect } from "react";
import { Formik, Form, Field } from "formik";
import transactionService from "../services/transactionService";
import "./accounts.scss";

const Accounts = () => {
  const [accounts, setAccounts] = useState();

  useEffect(() => {
    getAccounts();
  }, []);

  async function getAccounts() {
    const accounts = await transactionService.getAllUserAccounts();
    setAccounts(accounts);
  }
  return (
    <div className={"accounts-wrapper"}>
      <Sidebar refreshAccounts={getAccounts()} />
      <AccountsList accounts={accounts} />
    </div>
  );
};

const Sidebar = ({ refreshAccounts }) => {
  return (
    <div className={"accounts-wrapper__sidebar"}>
      <CreateAccount refreshAccounts={refreshAccounts} />
    </div>
  );
};

const CreateAccount = ({ refreshAccounts }) => {
  const accountTypes = ["Bank Account", "Investment Account", "Hard Cash"];
  return (
    <div className={"add-account"}>
      <Formik
        initialValues={{
          amount: "",
          name: "",
          currency: "",
          type: "",
        }}
        onSubmit={async (values, { setSubmitting, resetForm }) => {
          console.log(values);
          await transactionService.addAccount(values);
          await refreshAccounts();
        }}
      >
        {() => (
          <Form className={"form"}>
            <label>Add an account</label>
            <Field type="text" name="name" placeholder="Name of the account" />
            <Field
              type="text"
              name="currency"
              placeholder="Currency EUR, USD, BGN"
            />
            <Field type="text" name="amount" placeholder="Amount" />
            <Field as="select" name="type">
              <option value="" disabled hidden>
                Select account type
              </option>
              {accountTypes &&
                accountTypes.map((type, index) => (
                  <option key={index} value={index}>
                    {type}
                  </option>
                ))}
            </Field>
            <button type="submit">Add Account</button>
          </Form>
        )}
      </Formik>
    </div>
  );
};

const AccountsList = ({ accounts }) => {
  const [shownAccounts = accounts, setShownAccounts] = useState();

  useEffect(filterAccounts, [accounts]);

  function filterAccounts() {}

  return (
    <div className={"accounts-wrapper__accounts-list"}>
      <div className={"header"}>
        <label>Date:</label>
        <label>Name</label>
        <label>Amount:</label>
        <label>Type</label>
      </div>
      <div className={"accounts"}>
        {shownAccounts?.length > 0 &&
          shownAccounts.map((account) => (
            <AccountItem key={account.id} account={account} />
          ))}
      </div>
    </div>
  );
};

const AccountItem = ({ account }) => {
  const accountTypes = ["Bank Account", "Investment Account", "Hard Cash"];
  return (
    <div className="account-item">
      <label id="date">{new Date(account.created_on).toDateString()}</label>
      <label id="name">{account.name}</label>
      <label id="amount">{parseFloat(account.amount).toFixed(2)} €</label>
      <label id="type">{accountTypes[account.type]}</label>
    </div>
  );
};

export default Accounts;
