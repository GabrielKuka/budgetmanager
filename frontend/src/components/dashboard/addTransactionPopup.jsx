import React, { useMemo, useState } from "react";
import "./addTransactionPopup.scss";
import { Formik, Form, Field } from "formik";
import { useToast } from "../../context/ToastContext";
import { helper } from "../helper";
import currencyService from "../../services/currencyService";
import { useGlobalContext } from "../../context/GlobalContext";
import { validationSchemas } from "../../validationSchemas";
import transactionService from "../../services/transactionService/transactionService";

const TX_LABELS = {
  "0": "income",
  "1": "expense",
  "2": "transfer",
  "3": "buy",
  "4": "sell",
};

const AddTransactionPopup = ({ showPopup, refreshAccounts }) => {
  const global = useGlobalContext();
  const showToast = useToast();
  const [addingTransaction, setAddingTransaction] = useState(false);
  const [tags, setTags] = useState([]);
  const [transactionType, setTransactionType] = useState("1");
  const [customRate, setCustomRate] = useState("");

  const cashBalanceOptions = useMemo(() => {
    const options = [];
    (global.activeAccounts || []).forEach((account) => {
      (account.cash_balances || []).forEach((balance) => {
        options.push({
          id: balance.id,
          accountId: account.id,
          accountName: account.name,
          currencyCode: balance.currency?.code || account.currency,
          balance: balance.balance,
        });
      });
    });
    return options.sort((a, b) =>
      `${a.accountName}-${a.currencyCode}`.localeCompare(
        `${b.accountName}-${b.currencyCode}`
      )
    );
  }, [global.activeAccounts]);

  const accountOptions = useMemo(() => {
    return (global.activeAccounts || [])
      .map((account) => ({
        id: account.id,
        name: account.name,
        balancesCount: (account.cash_balances || []).length,
      }))
      .filter((account) => account.balancesCount > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [global.activeAccounts]);

  const holdingOptions = useMemo(() => {
    const options = [];
    (global.activeAccounts || []).forEach((account) => {
      (account.holdings || []).forEach((holding) => {
        options.push({
          id: holding.id,
          accountId: account.id,
          accountName: account.name,
          securityTicker: holding.security?.ticker,
          securityName: holding.security?.name,
          quantity: holding.quantity,
        });
      });
    });
    return options.sort((a, b) =>
      `${a.accountName}-${a.securityTicker}`.localeCompare(
        `${b.accountName}-${b.securityTicker}`
      )
    );
  }, [global.activeAccounts]);

  const getBalanceCurrencyById = (id) => {
    if (!id) {
      return "";
    }
    const balance = cashBalanceOptions.find((item) => item.id === Number(id));
    return balance?.currencyCode || "";
  };

  const getBalancesByAccountId = (accountId) => {
    if (!accountId) {
      return [];
    }
    return cashBalanceOptions.filter(
      (balance) => balance.accountId === Number(accountId)
    );
  };

  const getBalanceLabel = (item) =>
    `${item.currencyCode} (${helper.formatNumber(item.balance || 0, 2)})`;

  function addTag(e) {
    e.preventDefault();
    const input = document.getElementById("add_tag_textfield");
    if (!input?.value) {
      return;
    }
    if (!tags.includes(input.value)) {
      setTags([...tags, input.value]);
      input.value = "";
      input.focus();
    }
  }

  async function submitTransaction(values) {
    const txTypeNum = parseInt(transactionType, 10);
    const payload = {
      type: txTypeNum,
      date: values.date,
      description: values.description,
      tags: tags.map((tag) => ({ name: tag })),
    };

    if (transactionType === "0") {
      payload.amount = values.amount;
      payload.to_cash_balance = parseInt(values.to_cash_balance, 10);
      payload.category = parseInt(values.category, 10);
    } else if (transactionType === "1") {
      payload.amount = values.amount;
      payload.from_cash_balance = parseInt(values.from_cash_balance, 10);
      payload.category = parseInt(values.category, 10);
    } else if (transactionType === "2") {
      payload.from_amount = values.amount;
      payload.from_cash_balance = parseInt(values.from_cash_balance, 10);
      payload.to_cash_balance = parseInt(values.to_cash_balance, 10);
      const fromCurrency = getBalanceCurrencyById(values.from_cash_balance);
      const toCurrency = getBalanceCurrencyById(values.to_cash_balance);
      if (fromCurrency && toCurrency && fromCurrency !== toCurrency) {
        payload.to_amount = Number(customRate || 0) * Number(values.amount || 0);
      } else {
        payload.to_amount = values.amount;
      }
    } else if (transactionType === "3") {
      payload.from_cash_balance = parseInt(values.from_cash_balance, 10);
      payload.security = values.security;
      payload.quantity = values.quantity;
      payload.price_per_unit = values.price_per_unit;
    } else if (transactionType === "4") {
      payload.to_cash_balance = parseInt(values.to_cash_balance, 10);
      payload.holding = parseInt(values.holding, 10);
      payload.quantity = values.quantity;
      payload.price_per_unit = values.price_per_unit;
    }

    await transactionService.addTransaction(payload);
    await global.updateTransactions();
    await refreshAccounts();
    showToast(`${TX_LABELS[transactionType]} added.`);
  }

  async function handleRate(fieldName, setFieldValue, selectedValue) {
    setFieldValue(fieldName, selectedValue);

    const fromBalance = fieldName === "from_cash_balance" ? selectedValue : null;
    const toBalance = fieldName === "to_cash_balance" ? selectedValue : null;

    const fromSelected =
      fromBalance || document.getElementById("from_cash_balance")?.value;
    const toSelected =
      toBalance || document.getElementById("to_cash_balance")?.value;

    if (!fromSelected || !toSelected) {
      setCustomRate("");
      return;
    }

    const fromCurrency = getBalanceCurrencyById(fromSelected);
    const toCurrency = getBalanceCurrencyById(toSelected);
    if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) {
      setCustomRate("");
      return;
    }

    const defaultRate = await currencyService.convert(fromCurrency, toCurrency, 1);
    setCustomRate(defaultRate);
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
              quantity: "",
              price_per_unit: "",
              security: "",
              holding: "",
              description: "",
              date: new Date().toISOString().slice(0, 10),
              from_account: "",
              to_account: "",
              from_cash_balance: "",
              to_cash_balance: "",
              category: "",
              transaction_type: transactionType,
            }}
            validationSchema={validationSchemas.addTransactionSchema}
            validateOnBlur={false}
            validateOnChange={false}
            onSubmit={async (values, { setSubmitting, resetForm, validateForm }) => {
              const errors = await validateForm();
              if (Object.keys(errors || {}).length > 0) {
                setSubmitting(false);
                return;
              }

              setAddingTransaction(true);
              try {
                await submitTransaction(values);
                setTags([]);
                setCustomRate("");
                resetForm();
                showPopup(false);
              } finally {
                setAddingTransaction(false);
                setSubmitting(false);
              }
            }}
          >
            {({ values, setFieldValue, errors, touched, resetForm }) => {
              const sourceBalances = getBalancesByAccountId(values.from_account);
              const destinationBalances = getBalancesByAccountId(values.to_account);
              const amountCurrencyCode =
                transactionType === "0"
                  ? getBalanceCurrencyById(values.to_cash_balance)
                  : transactionType === "1" ||
                      transactionType === "2" ||
                      transactionType === "3"
                    ? getBalanceCurrencyById(values.from_cash_balance)
                    : "";
              const amountCurrencySymbol = amountCurrencyCode
                ? helper.getCurrency(amountCurrencyCode)
                : "";
              const amountPlaceholder = amountCurrencyCode
                ? `Amount (${amountCurrencyCode})`
                : "Amount";

              return (
                <Form className={"form"}>
                <div id="transaction_type_div">
                  <Field
                    as="select"
                    name="transaction_type"
                    className="select_field"
                    id="transaction_type_select"
                    value={values.transaction_type}
                    onChange={(e) => {
                      setFieldValue("transaction_type", e.target.value);
                      setTransactionType(e.target.value);
                      setFieldValue("from_account", "");
                      setFieldValue("to_account", "");
                      setFieldValue("from_cash_balance", "");
                      setFieldValue("to_cash_balance", "");
                      setCustomRate("");
                    }}
                  >
                    <option value="1">Expense</option>
                    <option value="0">Income</option>
                    <option value="2">Transfer</option>
                    <option value="3">Buy</option>
                    <option value="4">Sell</option>
                  </Field>
                </div>

                <Field type="text" id="date" name="date" placeholder="Enter date" />

                {(transactionType === "1" ||
                  transactionType === "2" ||
                  transactionType === "3") && (
                  <div className="cash_balance_row">
                    <Field
                      as="select"
                      name="from_account"
                      className="select_field"
                      id="from_account"
                      onChange={(e) => {
                        setFieldValue("from_account", e.target.value);
                        setFieldValue("from_cash_balance", "");
                        if (transactionType === "2") {
                          setCustomRate("");
                        }
                      }}
                    >
                      <option value="" disabled hidden>
                        Source account
                      </option>
                      {accountOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </Field>
                    <Field
                      as="select"
                      name="from_cash_balance"
                      className="select_field"
                      id="from_cash_balance"
                      disabled={!values.from_account}
                      onChange={(e) =>
                        transactionType === "2"
                          ? handleRate(
                              "from_cash_balance",
                              setFieldValue,
                              e.target.value
                            )
                          : setFieldValue("from_cash_balance", e.target.value)
                      }
                    >
                      <option value="" disabled hidden>
                        Source cash balance
                      </option>
                      {sourceBalances.map((item) => (
                        <option key={item.id} value={item.id}>
                          {getBalanceLabel(item)}
                        </option>
                      ))}
                    </Field>
                  </div>
                )}

                {(transactionType === "0" ||
                  transactionType === "2" ||
                  transactionType === "4") && (
                  <div className="cash_balance_row">
                    <Field
                      as="select"
                      name="to_account"
                      className="select_field"
                      id="to_account"
                      onChange={(e) => {
                        setFieldValue("to_account", e.target.value);
                        setFieldValue("to_cash_balance", "");
                        if (transactionType === "2") {
                          setCustomRate("");
                        }
                      }}
                    >
                      <option value="" disabled hidden>
                        Destination account
                      </option>
                      {accountOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </Field>
                    <Field
                      as="select"
                      name="to_cash_balance"
                      className="select_field"
                      id="to_cash_balance"
                      disabled={!values.to_account}
                      onChange={(e) =>
                        transactionType === "2"
                          ? handleRate("to_cash_balance", setFieldValue, e.target.value)
                          : setFieldValue("to_cash_balance", e.target.value)
                      }
                    >
                      <option value="" disabled hidden>
                        Destination cash balance
                      </option>
                      {destinationBalances.map((item) => (
                        <option key={item.id} value={item.id}>
                          {getBalanceLabel(item)}
                        </option>
                      ))}
                    </Field>
                  </div>
                )}

                {(transactionType === "0" ||
                  transactionType === "1" ||
                  transactionType === "2") && (
                  <div className="amount_row">
                    <Field
                      type="text"
                      id="amount"
                      name="amount"
                      placeholder={amountPlaceholder}
                    />
                    <span className="amount_currency_chip">
                      {amountCurrencySymbol || amountCurrencyCode || "-"}
                    </span>
                  </div>
                )}

                {(transactionType === "3" || transactionType === "4") && (
                  <>
                    <Field
                      type="text"
                      id="quantity"
                      name="quantity"
                      placeholder="Quantity"
                    />
                    <Field
                      type="text"
                      id="price_per_unit"
                      name="price_per_unit"
                      placeholder="Price per unit"
                    />
                  </>
                )}

                {transactionType === "3" && (
                  <Field
                    type="text"
                    id="security"
                    name="security"
                    placeholder="Ticker or Security ID"
                  />
                )}

                {transactionType === "4" && (
                  <Field as="select" name="holding" className="select_field">
                    <option value="" disabled hidden>
                      Select holding
                    </option>
                    {holdingOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.accountName} - {item.securityTicker} (
                        {helper.formatNumber(item.quantity || 0, 4)})
                      </option>
                    ))}
                  </Field>
                )}

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
                            onClick={() =>
                              setTags(tags.filter((currentTag) => currentTag !== t))
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

                {(transactionType === "0" || transactionType === "1") && (
                  <Field as="select" name="category" className="select_field">
                    <option value="" disabled hidden>
                      Choose category
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
                    Add {TX_LABELS[transactionType]}
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
                    onClick={() => showToast("Not implemented yet.")}
                  >
                    Save as Draft
                  </button>
                  {transactionType === "2" && customRate !== "" && (
                    <div id="custom_rate_container">
                      <span>
                        1 {getBalanceCurrencyById(values.from_cash_balance)} ={" "}
                      </span>
                      <input
                        type="text"
                        value={customRate}
                        id="custom_rate_field"
                        onChange={(e) => setCustomRate(e.target.value)}
                      />
                      <span> {getBalanceCurrencyById(values.to_cash_balance)}</span>
                      {values.amount !== "" && (
                        <span id="conversion_result">
                          Total:{" "}
                          <b>
                            {helper.formatNumber(
                              parseFloat(customRate || 0) *
                                parseFloat(values.amount || 0)
                            )}{" "}
                            {getBalanceCurrencyById(values.to_cash_balance)}
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

                {errors.date && touched.date ? <span>{errors.date}</span> : null}
                {errors.from_cash_balance && touched.from_cash_balance ? (
                  <span>{errors.from_cash_balance}</span>
                ) : null}
                {errors.to_cash_balance && touched.to_cash_balance ? (
                  <span>{errors.to_cash_balance}</span>
                ) : null}
                {errors.amount && touched.amount ? <span>{errors.amount}</span> : null}
                {errors.quantity && touched.quantity ? (
                  <span>{errors.quantity}</span>
                ) : null}
                {errors.price_per_unit && touched.price_per_unit ? (
                  <span>{errors.price_per_unit}</span>
                ) : null}
                {errors.security && touched.security ? (
                  <span>{errors.security}</span>
                ) : null}
                {errors.holding && touched.holding ? (
                  <span>{errors.holding}</span>
                ) : null}
                {errors.description && touched.description ? (
                  <span>{errors.description}</span>
                ) : null}
                {errors.category && touched.category ? (
                  <span>{errors.category}</span>
                ) : null}
                </Form>
              );
            }}
          </Formik>
        </div>
      </div>
    </>
  );
};

export default AddTransactionPopup;
