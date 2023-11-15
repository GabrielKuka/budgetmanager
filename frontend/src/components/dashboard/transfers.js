import React, { useState, useEffect } from "react";
import { Formik, Form, Field } from "formik";
import transactionService from "../../services/transactionService/transactionService";
import DatePicker from "react-datepicker";
import "./transfers.scss";
import NoDataCard from "../core/nodata";
import { useToast } from "../../context/ToastContext";
import { helper } from "../helper";

const Transfers = () => {
  const [isLoading, setIsLoading] = useState(true);
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
    const transfers = await transactionService
      .getAllUserTransfers()
      .finally(() => setIsLoading(false));
    setTransfers(transfers);
  }

  function getAccountCurrency(id) {
    const account = accounts.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  return (
    <div className={"transfers-wrapper"}>
      <Sidebar
        accounts={accounts}
        refreshTransfers={getTransfers}
        refreshAccounts={getAccounts}
        getAccountCurrency={getAccountCurrency}
      />
      {!isLoading && (
        <>
          {!transfers.length ? (
            <NoDataCard
              header={"No transfers found."}
              label={"Add a transfer"}
              focusOn={"date"}
            />
          ) : (
            <TransfersList
              transfers={transfers}
              accounts={accounts}
              getAccountCurrency={getAccountCurrency}
            />
          )}
        </>
      )}
    </div>
  );
};

const Sidebar = ({
  accounts,
  refreshTransfers,
  refreshAccounts,
  getAccountCurrency,
}) => {
  return (
    <div className={"transfers-wrapper__sidebar"}>
      <AddTransfer
        accounts={accounts}
        refreshTransfers={refreshTransfers}
        refreshAccounts={refreshAccounts}
        getAccountCurrency={getAccountCurrency}
      />
    </div>
  );
};

const AddTransfer = ({
  accounts,
  refreshTransfers,
  refreshAccounts,
  getAccountCurrency,
}) => {
  const showToast = useToast();
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
          values["type"] = 2;
          await transactionService.addTransfer(values);
          await refreshTransfers();
          await refreshAccounts();
          showToast("Transfer Added", "info");
          resetForm();
          setSubmitting(false);
        }}
      >
        {() => (
          <Form className={"form"}>
            <label onClick={() => document.getElementById("date").focus()}>
              Enter Tranfer
            </label>
            <Field type="text" id="date" name="date" placeholder="Enter date" />
            <Field as="select" name="from_account">
              <option value="" disabled hidden>
                From account
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
            <Field as="select" name="to_account">
              <option value="" disabled hidden>
                To account
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

const TransfersList = ({ transfers, accounts, getAccountCurrency }) => {
  const [shownTransfers = transfers, setShownTransfers] = useState({});
  const [sortedBy, setSortedBy] = useState({});

  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });

  useEffect(filterTransfers, [dateRange, transfers]);
  useEffect(filterTransfers, []);

  function filterTransfers() {
    const selectedFromAccount = document.getElementById("from_account")?.value;
    const selectedToAccount = document.getElementById("to_account")?.value;

    const fromDate = dateRange.from;
    const toDate = dateRange.to;

    const toAccountFilter =
      selectedToAccount >= 0
        ? transfers.filter((t) => t.to_account == selectedToAccount)
        : transfers;

    const fromAccountFilter =
      selectedFromAccount >= 0
        ? transfers.filter((t) => t.from_account == selectedFromAccount)
        : transfers;

    const dateFilter = transfers.filter(
      (t) => new Date(t.date) >= fromDate && new Date(t.date) <= toDate
    );

    const filteredtransfers = toAccountFilter
      .filter((t) => fromAccountFilter.includes(t))
      .filter((t) => dateFilter.includes(t))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
    setShownTransfers(filteredtransfers);
  }
  function sortShownTransfers(by = "") {
    if (!by) {
      return;
    }

    let sorted = null;

    if (by == "date") {
      if ("date" in sortedBy) {
        if (sortedBy["date"] == "ascending") {
          sorted = [...shownTransfers].sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          );
          setSortedBy({ date: "descending" });
        } else {
          sorted = [...shownTransfers].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
          );
          setSortedBy({ date: "ascending" });
        }
      } else {
        sorted = [...shownTransfers].sort(
          (a, b) => new Date(a.date) - new Date(b.date)
        );
        setSortedBy({ date: "ascending" });
      }
      setShownTransfers(sorted);
      return;
    }

    if (`${by}` in sortedBy) {
      if (sortedBy[`${by}`] == "ascending") {
        sorted = [...shownTransfers].sort((a, b) => b[`${by}`] - a[`${by}`]);
        setSortedBy({ [by]: "descending" });
      } else {
        sorted = [...shownTransfers].sort((a, b) => a[`${by}`] - b[`${by}`]);
        setSortedBy({ [by]: "ascending" });
      }
    } else {
      sorted = [...shownTransfers].sort((a, b) => a[`${by}`] - b[`${by}`]);
      setSortedBy({ [by]: "ascending" });
    }
    setShownTransfers(sorted);
  }

  return (
    <div className={"transfers-wrapper__transfers-list"}>
      <div className={"header"}>
        <div>
          <label onClick={() => sortShownTransfers("date")}>Date:</label>
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
          <div className={"fromDatePicker"}>
            <span className={"tooltip"}>From: </span>
            <DatePicker
              className="datepicker"
              selected={dateRange.from}
              onChange={(date) =>
                setDateRange((prev) => ({
                  ...prev,
                  from: date,
                }))
              }
              showMonthDropdown
              dateFormat={"yyyy-MM-dd"}
            />
          </div>
          <div className={"toDatePicker"}>
            <span className={"tooltip"}>To:</span>
            <DatePicker
              className="datepicker"
              selected={dateRange.to}
              onChange={(date) =>
                setDateRange((prev) => ({
                  ...prev,
                  to: date,
                }))
              }
              showMonthDropdown
              dateFormat={"yyyy-MM-dd"}
            />
          </div>
        </div>
        <label>Description</label>
        <div>
          <label onClick={() => sortShownTransfers("from_account")}>
            From Account:
          </label>
          {sortedBy["from_account"] == "ascending" && (
            <img
              src={`${process.env.PUBLIC_URL}/up_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
          {sortedBy["from_account"] == "descending" && (
            <img
              src={`${process.env.PUBLIC_URL}/down_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
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
          <label onClick={() => sortShownTransfers("to_account")}>
            To Account:
          </label>
          {sortedBy["to_account"] == "ascending" && (
            <img
              src={`${process.env.PUBLIC_URL}/up_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
          {sortedBy["to_account"] == "descending" && (
            <img
              src={`${process.env.PUBLIC_URL}/down_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
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
        <div>
          <label onClick={() => sortShownTransfers("amount")}>Amount</label>
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
      </div>
      <div className={"transfers"}>
        {shownTransfers?.length > 0 &&
          shownTransfers.map((transfer) => (
            <TransferItem
              key={transfer.id}
              transfer={transfer}
              accounts={accounts}
              currency={helper.getCurrency(
                getAccountCurrency(transfer.from_account)
              )}
            />
          ))}
      </div>
    </div>
  );
};

const TransferItem = ({ transfer, accounts, currency }) => {
  function getAccountName(id) {
    const account = accounts.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].name;
    }
    return "Not found";
  }

  function isRecent(input_datetime) {
    const now = new Date();
    input_datetime = new Date(input_datetime);
    const diffInMs = now.getTime() - input_datetime.getTime();
    const diffInHrs = diffInMs / (1000 * 60 * 60);
    return diffInHrs <= 5;
  }

  return (
    <div className="transfer-item">
      {isRecent(transfer.created_on) && (
        <label className="new-transaction">NEW!</label>
      )}
      <label id="date">{transfer.date}</label>
      <label id="description">{transfer.description}</label>
      <label id="from_account">{getAccountName(transfer.from_account)}</label>
      <label id="to_account">{getAccountName(transfer.to_account)}</label>
      <label id="amount">
        {parseFloat(transfer.amount).toFixed(2)} {currency}
      </label>
    </div>
  );
};

export default Transfers;
