import { React, useState, useEffect } from "react";
import { Formik, Form, Field } from "formik";
import transactionService from "../services/transactionService/transactionService";
import NoDataCard from "./core/nodata";
import "./accounts.scss";
import { useToast } from "../context/ToastContext";
import ConfirmDialog from "./core/confirm";
import { useConfirm } from "../context/ConfirmContext";

const Accounts = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    getAccounts();
  }, []);

  async function getAccounts() {
    const accounts = await transactionService
      .getAllUserAccounts()
      .finally(() => setIsLoading(false));
    setAccounts(accounts);
  }

  return (
    <div className={"accounts-wrapper"}>
      <Sidebar accounts={accounts} refreshAccounts={getAccounts} />
      {!isLoading && (
        <>
          {!accounts.length ? (
            <NoDataCard
              header={"No accounts found."}
              label={"Add an account"}
              focusOn={"name"}
            />
          ) : (
            <AccountsList
              accounts={accounts}
              refreshAccounts={getAccounts}
              setAccounts={setAccounts}
            />
          )}
        </>
      )}
    </div>
  );
};

const Sidebar = ({ accounts, refreshAccounts }) => {
  const total = parseFloat(
    accounts.reduce((t, curr) => (t += parseFloat(curr.amount)), 0)
  ).toFixed(2);
  return (
    <div className={"accounts-wrapper__sidebar"}>
      <CreateAccount refreshAccounts={refreshAccounts} />
      <label>
        Total: <b>{total} €</b>
      </label>
    </div>
  );
};

const CreateAccount = ({ refreshAccounts }) => {
  const accountTypes = ["Bank Account", "Investment Account", "Hard Cash"];
  const showToast = useToast();
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
          await transactionService.addAccount(values);
          await refreshAccounts();
          showToast("Account Created", "success");
          setSubmitting(false);
          resetForm();
        }}
      >
        {() => (
          <Form className={"form"}>
            <label onClick={() => document.getElementById("name").focus()}>
              Add an account
            </label>
            <Field
              type="text"
              id="name"
              name="name"
              placeholder="Name of the account"
            />
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

const AccountsList = ({ accounts, refreshAccounts, setAccounts }) => {
  function sortByAmount() {
    let sortedAccounts = accounts.sort((a, b) =>
      a.amount <= b.amount ? 1 : -1
    );
    console.log(sortedAccounts);
    setAccounts([...sortedAccounts]);
  }

  return (
    <div className={"accounts-wrapper__accounts-list"}>
      <div className={"header"}>
        <label>Date</label>
        <label>Name</label>
        <label onClick={sortByAmount}>Amount</label>
        <label>Type</label>
      </div>
      <div className={"accounts"}>
        {accounts?.length > 0 &&
          accounts.map((account) => (
            <AccountItem
              key={account.id}
              account={account}
              refreshAccounts={refreshAccounts}
            />
          ))}
      </div>
    </div>
  );
};

const AccountItem = ({ account, refreshAccounts }) => {
  const accountTypes = ["Bank Account", "Investment Account", "Hard Cash"];
  const showToast = useToast();
  const showConfirm = useConfirm();

  async function deleteAccount() {
    showConfirm(`Delete ${account.name}?`, async () => {
      await transactionService.deleteAccount(account.id);
      await refreshAccounts();
      showToast("Account Deleted", "info");
    });
  }

  return (
    <div className="account-item">
      <label id="date">
        {new Date(account.created_on).toISOString().slice(0, 10)}
      </label>
      <label id="name">{account.name}</label>
      <label id="amount">{parseFloat(account.amount).toFixed(2)} €</label>
      <label id="type">{accountTypes[account.type]}</label>
      <button onClick={deleteAccount}>X</button>
    </div>
  );
};

export default Accounts;
