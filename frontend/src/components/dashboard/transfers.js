import React, { useState, useEffect } from "react";
import { Formik, Form, Field } from "formik";
import transactionService from "../../services/transactionService";
import DatePicker from "react-datepicker";
import "./transfers.scss";

const Transfers = () => {
  const [transfers, setTransfers] = useState([]);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    getTransfers();
    getAccounts();
  }, []);

  async function getAccounts() {
    const accounts = await transactionService.getAllUserAccounts();
    setAccounts(accounts);
  }
  async function getTransfers() {
    const transfers = await transactionService.getAllUserTransfers();
    setTransfers(transfers);
  }

  return (
    <div className={"transfers-wrapper"}>
      <Sidebar accounts={accounts} refreshTransfers={getTransfers} />
      {transfers?.length > 0 && (
        <TransfersList transfers={transfers} accounts={accounts} />
      )}
    </div>
  );
};

const Sidebar = ({ accounts, refreshTransfers }) => {
  return (
    <div className={"transfers-wrapper__sidebar"}>
      <AddTransfer accounts={accounts} refreshTransfers={refreshTransfers} />
    </div>
  );
};

const AddTransfer = ({ accounts, refreshTransfers }) => {
  return (
    <div className={"enter-transfer"}>
      <Formik
        initialValues={{
          amount: "",
          from_account: "",
          to_account: "",
          description: "",
          date: new Date().toISOString().slice(0, 10),
        }}
        onSubmit={async (values, { resetForm, setSubmitting }) => {
          console.log(values);
          values["type"] = 2;
          await transactionService.addTransfer(values);
          await refreshTransfers();
          resetForm();
          setSubmitting(false);
        }}
      >
        {() => (
          <Form className={"form"}>
            <label>Enter Tranfer</label>
            <Field type="text" name="date" placeholder="Enter date" />
            <Field as="select" name="from_account">
              <option value="" disabled hidden>
                From account
              </option>
              {accounts &&
                accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {parseFloat(a.amount).toFixed(2)} €
                  </option>
                ))}
            </Field>
            <Field as="select" name="to_account">
              <option value="" disabled hidden>
                To account
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
            <button type="submit">Submit</button>
          </Form>
        )}
      </Formik>
    </div>
  );
};

const TransfersList = ({ transfers, accounts }) => {
  const [shownTransfers = transfers, setShownTransfers] = useState();
  const [date, setDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  useEffect(filterTransfers, [date, transfers]);
  useEffect(filterTransfers, []);

  function filterTransfers() {
    const selectedFromAccount = document.getElementById("from_account").value;
    const selectedToAccount = document.getElementById("to_account").value;
    const selectedDate = date;

    const toAccountFilter =
      selectedToAccount >= 0
        ? transfers.filter((t) => t.to_account == selectedToAccount)
        : transfers;

    const fromAccountFilter =
      selectedFromAccount >= 0
        ? transfers.filter((t) => t.from_account == selectedFromAccount)
        : transfers;

    const dateFilter = transfers.filter(
      (t) => new Date(t.date) >= selectedDate
    );

    const filteredtransfers = toAccountFilter
      .filter((t) => fromAccountFilter.includes(t))
      .filter((t) => dateFilter.includes(t))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
    setShownTransfers(filteredtransfers);
  }
  return (
    <div className={"transfers-wrapper__transfers-list"}>
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
          <label>From Account:</label>
          <select
            id="from_account"
            defaultValue={"-1"}
            onChange={filterTransfers}
          >
            <option value="-1">All</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>To Account:</label>
          <select
            id="to_account"
            defaultValue={"-1"}
            onChange={filterTransfers}
          >
            <option value="-1">All</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <label>Amount</label>
      </div>
      <div className={"transfers"}>
        {shownTransfers?.length > 0 &&
          shownTransfers.map((transfer) => (
            <TransferItem
              key={transfer.id}
              transfer={transfer}
              accounts={accounts}
            />
          ))}
      </div>
    </div>
  );
};

const TransferItem = ({ transfer, accounts }) => {
  function getAccountName(id) {
    const account = accounts.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].name;
    }
    return "Not found";
  }

  return (
    <div className="transfer-item">
      <label id="date">{transfer.date}</label>
      <label id="description">{transfer.description}</label>
      <label id="from_account">{getAccountName(transfer.from_account)}</label>
      <label id="to_account">{getAccountName(transfer.to_account)}</label>
      <label id="amount">{parseFloat(transfer.amount).toFixed(2)} €</label>
    </div>
  );
};

export default Transfers;
