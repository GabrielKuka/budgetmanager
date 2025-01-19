import React, { useState, useEffect, useRef } from "react";
import TransactionItem from "./transactionItem";
import { Formik, Form, Field } from "formik";
import transactionService from "../../services/transactionService/transactionService";
import "./transfers.scss";
import NoDataCard from "../core/nodata";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { helper } from "../helper";
import TransactionPopup from "../core/transaction_popup";
import currencyService from "../../services/currencyService";
import { useGlobalContext } from "../../context/GlobalContext";
import LoadingCard from "../core/LoadingCard";
import { validationSchemas } from "../../validationSchemas";

const Transfers = () => {
  const global = useGlobalContext();
  const [accounts, setAccounts] = useState(global.activeAccounts);
  const [transactionPopup, setTransactionPopup] = useState(false);

  useEffect(() => {
    setAccounts(global.activeAccounts);
  }, [global.activeAccounts]);

  function getAccountCurrency(id) {
    const account = global.accounts.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  return (
    <div className={"transfers-wrapper"}>
      <Sidebar
        accounts={accounts}
        refreshTransfers={global.updateTransfers}
        refreshAccounts={global.updateAccounts}
        getAccountCurrency={getAccountCurrency}
      />
      {!global.transfers ? (
        <LoadingCard header="Loading Transfers..." />
      ) : global.transfers && !global.transfers?.length ? (
        <NoDataCard
          header={"No transfers found."}
          label={"Add a transfer"}
          focusOn={"date"}
        />
      ) : (
        <TransfersList
          transfers={global.transfers}
          accounts={accounts}
          getAccountCurrency={getAccountCurrency}
          refreshTransfers={global.updateTransfers}
          setTransactionPopup={setTransactionPopup}
          dateRange={global.dateRange}
        />
      )}
      {transactionPopup && (
        <TransactionPopup
          transaction={transactionPopup}
          type={2}
          showPopup={setTransactionPopup}
          refreshTransactions={global.updateTransfers}
          getAccountCurrency={getAccountCurrency}
          accounts={accounts}
        />
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
  const [tags, setTags] = useState([]);
  const [addingTransfer, setAddingTransfer] = useState(false);

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
    <div className={"enter-transfer"}>
      <Formik
        initialValues={{
          from_amount: "",
          from_account: "",
          to_account: "",
          description: "",
          date: new Date().toISOString().slice(0, 10),
        }}
        validationSchema={validationSchemas.transferFormSchema}
        validateOnBlur={false}
        validateOnChange={false}
        onSubmit={(values, { resetForm, setSubmitting, validateForm }) => {
          validateForm().then(async () => {
            setAddingTransfer(true);
            // if from and to accounts have different currencies, convert
            const from_currency = getAccountCurrency(
              parseInt(values["from_account"])
            );
            const to_currency = getAccountCurrency(
              parseInt(values["to_account"])
            );
            if (from_currency !== to_currency) {
              values["to_amount"] = await currencyService.convert(
                from_currency,
                to_currency,
                values["from_amount"]
              );
            } else {
              values["to_amount"] = values["from_amount"];
            }

            values["type"] = 2;
            values["tags"] = tags.map((tag) => ({
              name: tag,
            }));
            await transactionService.addTransfer(values);
            await refreshTransfers();
            await refreshAccounts();
            showToast("Transfer Added", "info");
            resetForm();
            setTags([]);
            setSubmitting(false);
            setAddingTransfer(false);
          });
        }}
      >
        {({ errors, touched }) => (
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
            <Field type="text" name="from_amount" placeholder="Enter amount" />
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
            <div id="submit_wrapper">
              <button type="submit" id={"submit-button"}>
                Add Transfer
              </button>
              {addingTransfer && (
                <img
                  src={process.env.PUBLIC_URL + "/loading_icon.gif"}
                  alt="loading icon"
                  width="27"
                  height="27"
                />
              )}
            </div>
            {errors.date && touched.date ? <span>{errors.date}</span> : null}
            {errors.from_account && touched.from_account ? (
              <span>{errors.from_account}</span>
            ) : null}
            {errors.to_account && touched.to_account ? (
              <span>{errors.to_account}</span>
            ) : null}
            {errors.from_amount && touched.from_amount ? (
              <span>{errors.from_amount}</span>
            ) : null}
            {errors.description && touched.description ? (
              <span>{errors.description}</span>
            ) : null}
          </Form>
        )}
      </Formik>
    </div>
  );
};

const TransfersList = ({
  transfers,
  accounts,
  getAccountCurrency,
  refreshTransfers,
  setTransactionPopup,
  dateRange,
}) => {
  const global = useGlobalContext();
  const [shownTransfers = transfers, setShownTransfers] = useState({});
  const [sortedBy, setSortedBy] = useState({});

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
            {global.accounts?.map((a) => (
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
            {global.accounts?.map((a) => (
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
            <TransactionItem
              key={transfer.id}
              transaction={transfer}
              refreshTransactions={refreshTransfers}
              //categories={props.categories}
              currency={helper.getCurrency(
                getAccountCurrency(transfer.from_account)
              )}
              setTransactionPopup={setTransactionPopup}
              refreshAccounts={global.updateAccounts}
            />
          ))}
      </div>
    </div>
  );
};

export default Transfers;
