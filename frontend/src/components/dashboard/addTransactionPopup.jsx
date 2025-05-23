import React, { useEffect, useState } from "react";
import "./addTransactionPopup.scss";
import { Formik, Form, Field } from "formik";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { helper } from "../helper";
import currencyService from "../../services/currencyService";
import { useGlobalContext } from "../../context/GlobalContext";
import { validationSchemas } from "../../validationSchemas";
import transactionService from "../../services/transactionService/transactionService";

const AddTransactionPopup = ({
  showPopup,
  getAccountCurrency,
  refreshAccounts,
}) => {
  const global = useGlobalContext();
  const showConfirm = useConfirm();
  const showToast = useToast();
  const [addingTransaction, setAddingTransaction] = useState(false);
  const [tags, setTags] = useState([]);
  const [transactionType, setTransactionType] = useState("1");
  const [validSchema, setValidSchema] = useState(
    validationSchemas.expenseFormSchema
  );

  const [categories, setCategories] = useState(global.expenseCategories);
  const [customRate, setCustomRate] = useState("");

  useEffect(() => {
    switch (transactionType) {
      case "0":
        setCategories(global.incomeCategories);
        setValidSchema(validationSchemas.incomeFormSchema);
        break;
      case "1":
        setCategories(global.expenseCategories);
        setValidSchema(validationSchemas.expenseFormSchema);
        break;
      case "2":
        setValidSchema(validationSchemas.transferFormSchema);
        break;
      default:
        break;
    }
  }, [transactionType]);

  function addTag(e) {
    e.preventDefault();
    const input = document.getElementById("add_tag_textfield");
    if (input.value === "") {
      return;
    }
    if (!tags.includes(e.target.previousElementSibling.value)) {
      setTags([...tags, e.target.previousElementSibling.value]);
      input.value = "";
      input.focus();
    }
  }

  async function addTransaction(payload) {
    let newPayload = null;
    const keyMap = {
      amount: transactionType === "2" ? "from_amount" : "amount",
    };
    switch (transactionType) {
      case "0":
        newPayload = Object.fromEntries(
          Object.entries(payload).map(([key, value]) => [
            keyMap[key] || key,
            value,
          ])
        );
        await transactionService.addIncome(newPayload);
        await global.updateIncomes();
        showToast("Income Added.");
        break;
      case "1":
        newPayload = Object.fromEntries(
          Object.entries(payload).map(([key, value]) => [
            keyMap[key] || key,
            value,
          ])
        );
        await transactionService.addExpense(newPayload);
        await global.updateExpenses();
        showToast("Expense Added.");
        break;
      case "2":
        newPayload = Object.fromEntries(
          Object.entries(payload).map(([key, value]) => [
            keyMap[key] || key,
            value,
          ])
        );
        const from_currency = getAccountCurrency(
          parseInt(newPayload["from_account"])
        );
        const to_currency = getAccountCurrency(
          parseInt(newPayload["to_account"])
        );
        if (from_currency !== to_currency) {
          newPayload["to_amount"] = customRate * newPayload["from_amount"];
        } else {
          newPayload["to_amount"] = newPayload["from_amount"];
        }
        await transactionService.addTransfer(newPayload);
        await global.updateTransfers();
        showToast("Transfer Added.");
        break;
      default:
        showToast("Wrong transaction type.");
        break;
    }
  }

  async function handleRate(fieldName, setFieldValue, selectedValue) {
    setFieldValue(fieldName, selectedValue);

    const fromAccountValue = document.getElementById("from_account").value;
    const toAccountValue = document.getElementById("to_account").value;

    const bothAccountsSet = fromAccountValue !== "" && toAccountValue !== "";

    if (bothAccountsSet) {
      // Check if currencies are different
      const fromCurrency = getAccountCurrency(fromAccountValue);
      const toCurrency = getAccountCurrency(toAccountValue);
      const differentCurrencies = fromCurrency !== toCurrency;
      if (differentCurrencies) {
        const defaultRate = await currencyService.convert(
          fromCurrency,
          toCurrency,
          1
        );
        setCustomRate(defaultRate);
        return;
      }
    }
    setCustomRate("");
  }

  return (
    <>
      <div className="overlay"></div>
      <div className="add_transaction_wrapper">
        <div className={"title-bar"}>
          <div className={"main"}>Add a new transaction</div>
          <button className={"close-popup"} onClick={() => showPopup(false)}>
            X
          </button>
        </div>
        <div className={"content"}>
          <Formik
            initialValues={{
              amount: "",
              description: "",
              date: new Date().toISOString().slice(0, 10),
              from_account: "",
              to_account: "",
              category: "",
              transaction_type: transactionType,
            }}
            validationSchema={validationSchemas.addTransactionSchema}
            validateOnBlur={false}
            validateOnChange={false}
            onSubmit={(values, { setSubmitting, resetForm, validateForm }) => {
              validateForm().then(async (errors) => {
                setAddingTransaction(true);
                values["type"] = parseInt(transactionType);
                values["tags"] = tags?.map((tag) => ({
                  name: tag,
                }));
                await addTransaction(values);
                await refreshAccounts();
                setSubmitting(false);
                setTags([]);
                resetForm();
                setCustomRate("");
                setAddingTransaction(false);
                showPopup(false);
              });
            }}
          >
            {({ values, setFieldValue, errors, touched, resetForm }) => (
              <Form className={"form"}>
                <div id="transaction_type_div" role="group">
                  <label className={"transaction_type_label"}>
                    <Field
                      type="radio"
                      name="transaction_type"
                      checked={values.transaction_type === "1"}
                      value="1"
                      onChange={(e) => {
                        setFieldValue("transaction_type", e.target.value);
                        setTransactionType(e.target.value);
                      }}
                    />
                    Expense
                  </label>
                  <label className={"transaction_type_label"}>
                    <Field
                      type="radio"
                      name="transaction_type"
                      checked={values.transaction_type === "0"}
                      value="0"
                      onChange={(e) => {
                        setFieldValue("transaction_type", e.target.value);
                        setTransactionType(e.target.value);
                      }}
                    />
                    Income
                  </label>
                  <label className={"transaction_type_label"}>
                    <Field
                      type="radio"
                      name="transaction_type"
                      checked={values.transaction_type === "2"}
                      value="2"
                      onChange={(e) => {
                        setFieldValue("transaction_type", e.target.value);
                        setTransactionType(e.target.value);
                      }}
                    />
                    Transfer
                  </label>
                </div>
                <Field
                  type="text"
                  id="date"
                  name="date"
                  placeholder="Enter date"
                />
                {transactionType === "2" ? (
                  <>
                    <Field
                      as="select"
                      name="from_account"
                      className="select_field"
                      id="from_account"
                      onChange={(e) =>
                        handleRate(
                          "from_account",
                          setFieldValue,
                          e.target.value
                        )
                      }
                    >
                      <option value="" disabled hidden>
                        From account
                      </option>
                      {global.activeAccounts
                        ?.sort((a, b) => (a.name > b.name ? 1 : -1))
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} {parseFloat(a.amount).toFixed(2)}{" "}
                            {helper.getCurrency(getAccountCurrency(a.id))}
                          </option>
                        ))}
                    </Field>
                    <Field
                      as="select"
                      name="to_account"
                      className="select_field"
                      id="to_account"
                      onChange={(e) =>
                        handleRate("to_account", setFieldValue, e.target.value)
                      }
                    >
                      <option value="" disabled hidden>
                        To account
                      </option>
                      {global.activeAccounts
                        ?.sort((a, b) => (a.name > b.name ? 1 : -1))
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} {parseFloat(a.amount).toFixed(2)}{" "}
                            {helper.getCurrency(getAccountCurrency(a.id))}
                          </option>
                        ))}
                    </Field>
                  </>
                ) : (
                  <Field
                    as="select"
                    name={`${transactionType === "0" ? "to" : "from"}_account`}
                    className="select_field"
                  >
                    <option value="" disabled hidden>
                      Select account
                    </option>
                    {global.activeAccounts
                      ?.sort((a, b) => (a.name > b.name ? 1 : -1))
                      ?.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} {parseFloat(a.amount).toFixed(2)}{" "}
                          {helper.getCurrency(getAccountCurrency(a.id))}
                        </option>
                      ))}
                  </Field>
                )}
                <Field
                  type="text"
                  id="amount"
                  name="amount"
                  placeholder={`Enter amount`}
                />
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
                      {tags?.map((t) => (
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
                  rows={3}
                  name="description"
                  id="description"
                  placeholder="Enter a description"
                />
                {transactionType !== "2" && (
                  <Field as="select" name="category" className="select_field">
                    <option value="" disabled hidden>
                      Choose an {transactionType === "0" && <>income</>}
                      {transactionType === "1" && <>expense</>} category
                    </option>
                    {transactionType === "0" &&
                      global.incomeCategories?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.category}
                        </option>
                      ))}
                    {transactionType === "1" &&
                      global.expenseCategories?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.category}
                        </option>
                      ))}
                  </Field>
                )}
                <div id="submit_wrapper">
                  <button type="submit" id={"submit-button"}>
                    Add {transactionType === "0" && <>income</>}
                    {transactionType === "1" && <>expense</>}
                    {transactionType === "2" && <>transfer</>}
                  </button>
                  <button
                    type="button"
                    id={"reset-button"}
                    onClick={() => {
                      setCustomRate("");
                      resetForm();
                      setTags([]);
                      setFieldValue("transaction_type", transactionType);
                    }}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    id={"draft-button"}
                    onClick={() => showToast("Not Implemented yet.")}
                  >
                    Save as Draft
                  </button>
                  {customRate !== "" && (
                    <div id="custom_rate_container">
                      <span>
                        1 {getAccountCurrency(values["from_account"])} ={" "}
                      </span>
                      <input
                        type="text"
                        value={customRate}
                        id="custom_rate_field"
                        onChange={(e) => setCustomRate(e.target.value)}
                      />
                      <span> {getAccountCurrency(values["to_account"])}</span>
                      {values["amount"] !== "" && (
                        <span id="conversion_result">
                          Total:{" "}
                          <b>
                            {helper.formatNumber(
                              parseFloat(customRate) *
                                parseFloat(values["amount"])
                            )}{" "}
                            {getAccountCurrency(values["to_account"])}
                          </b>
                        </span>
                      )}
                    </div>
                  )}
                  {addingTransaction && (
                    <img
                      src={process.env.PUBLIC_URL + "/loading_icon.gif"}
                      alt="loading icon"
                      width="27"
                      height="27"
                    />
                  )}
                </div>
                {errors.date && touched.date ? (
                  <span>{errors.date}</span>
                ) : null}
                {(transactionType === "0" || transactionType === "2") && (
                  <>
                    {errors.to_account && touched.to_account ? (
                      <span>{errors.to_account}</span>
                    ) : null}
                  </>
                )}
                {(transactionType === "1" || transactionType === "2") && (
                  <>
                    {errors.from_account && touched.from_account ? (
                      <span>{errors.from_account}</span>
                    ) : null}
                  </>
                )}
                {errors.amount && touched.amount ? (
                  <span>{errors.amount}</span>
                ) : null}
                {errors.description && touched.description ? (
                  <span>{errors.description}</span>
                ) : null}
                {transactionType !== "2" && (
                  <>
                    {errors.category && touched.category ? (
                      <span>{errors.category}</span>
                    ) : null}
                  </>
                )}
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </>
  );
};

export default AddTransactionPopup;
