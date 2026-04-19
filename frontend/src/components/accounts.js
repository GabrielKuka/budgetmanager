import { React, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Formik, Form, Field } from "formik";
import transactionService from "../services/transactionService/transactionService";
import NoDataCard from "./core/nodata";
import "./accounts.scss";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { helper } from "./helper";
import currencyService from "../services/currencyService";
import { useGlobalContext } from "../context/GlobalContext";
import { validationSchemas } from "../validationSchemas";

const Accounts = () => {
  const global = useGlobalContext();

  const [accounts, setAccounts] = useState(global.activeAccounts);
  const [accountTypeSelected, setAccountTypeSelected] = useState("active");

  useEffect(() => {
    setAccounts(global.activeAccounts);
  }, [global.activeAccounts]);

  return (
    <div className={"accounts-wrapper"}>
      <Sidebar accounts={accounts} refreshAccounts={global.updateAccounts} />
      {!accounts?.length ? (
        <NoDataCard
          header={"No accounts found."}
          label={"Add an account"}
          focusOn={"name"}
        />
      ) : (
        <AccountsList
          accounts={accounts}
          refreshAccounts={global.updateAccounts}
          accountTypeSelected={accountTypeSelected}
          setAccountTypeSelected={setAccountTypeSelected}
        />
      )}
    </div>
  );
};

const Sidebar = ({ accounts, refreshAccounts }) => {
  const global = useGlobalContext();
  const [investments, setInvestments] = useState(0);
  const [cash, setCash] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);

  function resolveHoldingValue(holding) {
    if (holding.market_value !== null && holding.market_value !== undefined) {
      return parseFloat(holding.market_value || 0);
    }
    if (
      holding.latest_price?.price !== null &&
      holding.latest_price?.price !== undefined
    ) {
      return (
        parseFloat(holding.quantity || 0) *
        parseFloat(holding.latest_price.price || 0)
      );
    }
    return (
      parseFloat(holding.quantity || 0) * parseFloat(holding.average_cost || 0)
    );
  }

  useEffect(() => {
    if (accounts == null) {
      return;
    }
    let active = true;

    async function computeSummary() {
      const sourceAccounts = accounts || [];
      const cashConversions = [];
      const holdingConversions = [];

      sourceAccounts.forEach((account) => {
        (account.cash_balances || []).forEach((balance) => {
          const fromCurrency = balance.currency?.code || account.currency;
          cashConversions.push(
            currencyService
              .convert(
                fromCurrency,
                global.globalCurrency,
                parseFloat(balance.balance || 0)
              )
              .then((value) => parseFloat(value || 0))
          );
        });

        (account.holdings || []).forEach((holding) => {
          const fromCurrency =
            holding.security?.currency?.code || account.currency;
          holdingConversions.push(
            currencyService
              .convert(
                fromCurrency,
                global.globalCurrency,
                resolveHoldingValue(holding)
              )
              .then((value) => parseFloat(value || 0))
          );
        });
      });

      const [cashResults, holdingResults] = await Promise.all([
        Promise.all(cashConversions),
        Promise.all(holdingConversions),
      ]);

      const cashTotal = cashResults.reduce((acc, curr) => acc + curr, 0);
      const investmentsTotal = holdingResults.reduce(
        (acc, curr) => acc + curr,
        0
      );

      if (active) {
        setCash(cashTotal);
        setInvestments(investmentsTotal);
        setTotalAssets(cashTotal + investmentsTotal);
      }
    }

    computeSummary();
    return () => {
      active = false;
    };
  }, [accounts, global.globalCurrency]);

  return (
    <div className={"accounts-wrapper__sidebar"}>
      <CreateAccount refreshAccounts={refreshAccounts} />
      <div className={"accounts-info"}>
        <div className={"card-label"}>Summary</div>
        <label>
          {
            <img
              alt="account-type"
              src={process.env.PUBLIC_URL + "/investment_icon.png"}
              width="20"
              height="17"
              style={{ marginRight: "10px" }}
            />
          }
          <span>Investments: </span>
          <small>
            {helper.showOrMask(
              global.privacyMode,
              helper.formatNumber(investments)
            )}{" "}
            {helper.getCurrency(global.globalCurrency)}
          </small>
        </label>
        <label>
          {
            <img
              alt="account-type"
              src={process.env.PUBLIC_URL + "/cash_icon.png"}
              width="20"
              height="17"
              style={{ marginRight: "10px" }}
            />
          }
          <span>Cash: </span>
          <small>
            {helper.showOrMask(global.privacyMode, helper.formatNumber(cash))}{" "}
            {helper.getCurrency(global.globalCurrency)}
          </small>
        </label>
        <label>
          <span>
            <b>Total:</b>{" "}
          </span>
          <b style={{ borderBottom: "2px solid #5F9EA0" }}>
            {helper.showOrMask(
              global.privacyMode,
              helper.formatNumber(totalAssets)
            )}{" "}
            {helper.getCurrency(global.globalCurrency)}
          </b>
        </label>
      </div>
    </div>
  );
};

const CreateAccount = ({ refreshAccounts }) => {
  const accountTypes = ["Bank Account", "Investment Account", "Hard Cash"];
  const currencies = ["EUR", "USD", "ALL", "BGN", "GBP"];
  const showToast = useToast();

  return (
    <div className={"add-account"}>
      <Formik
        initialValues={{
          name: "",
          type: "",
          cash_balances: [{ currency: "EUR", amount: "" }],
        }}
        validationSchema={validationSchemas.accountsFormSchema}
        validateOnChange={false}
        validateOnBlur={false}
        onSubmit={async (
          values,
          { setSubmitting, resetForm, validateForm }
        ) => {
          const errors = await validateForm();
          if (Object.keys(errors || {}).length > 0) {
            setSubmitting(false);
            return;
          }
          try {
            await transactionService.addAccount(values);
            await refreshAccounts();
            showToast("Account Created", "success");
            resetForm();
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({ values, errors, touched, setFieldValue }) => (
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
            {values.cash_balances.map((row, index) => (
              <div key={index} className="cash-balance-row">
                <div className="cash-balance-inline-row">
                  <Field
                    as="select"
                    name={`cash_balances[${index}].currency`}
                    value={row.currency}
                    className="cash-balance-currency"
                  >
                    <option value="" disabled hidden>
                      CUR
                    </option>
                    {currencies.map((currencyCode) => (
                      <option key={currencyCode} value={currencyCode}>
                        {currencyCode}
                      </option>
                    ))}
                  </Field>
                  <Field
                    type="text"
                    name={`cash_balances[${index}].amount`}
                    placeholder="Amount"
                    value={row.amount}
                    className="cash-balance-amount"
                  />
                  <div className="cash-balance-actions">
                    {values.cash_balances.length > 1 && (
                      <button
                        type="button"
                        title="Remove balance"
                        aria-label="Remove balance"
                        className="remove-balance-icon"
                        onClick={() => {
                          const nextRows = values.cash_balances.filter(
                            (_, i) => i !== index
                          );
                          setFieldValue("cash_balances", nextRows);
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                {errors.cash_balances?.[index]?.currency &&
                touched.cash_balances?.[index]?.currency ? (
                  <span>{errors.cash_balances[index].currency}</span>
                ) : null}
                {errors.cash_balances?.[index]?.amount &&
                touched.cash_balances?.[index]?.amount ? (
                  <span>{errors.cash_balances[index].amount}</span>
                ) : null}

                {index === values.cash_balances.length - 1 && (
                  <div className="cash-balance-actions">
                    <button
                      type="button"
                      onClick={() => {
                        const nextRows = [
                          ...values.cash_balances,
                          { currency: "EUR", amount: "" },
                        ];
                        setFieldValue("cash_balances", nextRows);
                      }}
                    >
                      + Balance
                    </button>
                  </div>
                )}
              </div>
            ))}
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
            <button type="submit" id="submit-button">
              Add Account
            </button>
            {errors.name && touched.name ? <span>{errors.name}</span> : null}
            {errors.currency && touched.currency ? (
              <span>{errors.currency}</span>
            ) : null}
            {errors.type && touched.type ? <span>{errors.type}</span> : null}
            {typeof errors.cash_balances === "string" ? (
              <span>{errors.cash_balances}</span>
            ) : null}
          </Form>
        )}
      </Formik>
    </div>
  );
};

const AccountsList = ({
  accounts,
  refreshAccounts,
  accountTypeSelected,
  setAccountTypeSelected,
}) => {
  const global = useGlobalContext();
  const [sortedBy, setSortedBy] = useState({ amount: "descending" });
  const [shownAccounts, setShownAccounts] = useState(accounts);
  const [accountTotals, setAccountTotals] = useState({});
  const [accountCashTotals, setAccountCashTotals] = useState({});
  const [accountHoldingTotals, setAccountHoldingTotals] = useState({});

  useEffect(() => {
    let active = true;

    async function computeAccountTotals() {
      const sourceAccounts = global.accounts || [];
      const convertedTotals = await Promise.all(
        sourceAccounts.map(async (account) => {
          let cashTotal = 0;
          let holdingsTotal = 0;

          for (const balance of account.cash_balances || []) {
            const balanceCurrency = balance.currency?.code || account.currency;
            const converted = await currencyService.convert(
              balanceCurrency,
              global.globalCurrency,
              parseFloat(balance.balance || 0)
            );
            cashTotal += parseFloat(converted || 0);
          }

          for (const holding of account.holdings || []) {
            const holdingCurrency =
              holding.security?.currency?.code || account.currency;
            let holdingValue = holding.market_value;

            if (holdingValue === null || holdingValue === undefined) {
              if (
                holding.latest_price?.price !== null &&
                holding.latest_price?.price !== undefined
              ) {
                holdingValue =
                  parseFloat(holding.quantity || 0) *
                  parseFloat(holding.latest_price.price || 0);
              } else {
                holdingValue =
                  parseFloat(holding.quantity || 0) *
                  parseFloat(holding.average_cost || 0);
              }
            }

            const converted = await currencyService.convert(
              holdingCurrency,
              global.globalCurrency,
              parseFloat(holdingValue || 0)
            );
            holdingsTotal += parseFloat(converted || 0);
          }

          return [account.id, { cashTotal, holdingsTotal }];
        })
      );

      if (active) {
        const totalsByAccount = {};
        const cashTotalsByAccount = {};
        const holdingsTotalsByAccount = {};
        convertedTotals.forEach(([accountId, values]) => {
          totalsByAccount[accountId] = values.cashTotal + values.holdingsTotal;
          cashTotalsByAccount[accountId] = values.cashTotal;
          holdingsTotalsByAccount[accountId] = values.holdingsTotal;
        });
        setAccountTotals(totalsByAccount);
        setAccountCashTotals(cashTotalsByAccount);
        setAccountHoldingTotals(holdingsTotalsByAccount);
      }
    }

    computeAccountTotals();
    return () => {
      active = false;
    };
  }, [global.accounts, global.globalCurrency]);

  useEffect(() => {
    const { by, order } = getSortConfig();
    if (accountTypeSelected === "deleted") {
      const deletedAccounts = (global.accounts || []).filter((a) => a.deleted);
      setShownAccounts(sortAccounts(deletedAccounts, by, order));
      return;
    }
    const activeAccounts = (accounts || []).filter((a) => !a.deleted);
    setShownAccounts(sortAccounts(activeAccounts, by, order));
  }, [accounts, accountTypeSelected, global.accounts, accountTotals, sortedBy]);

  function getSortConfig() {
    const [by, order] = Object.entries(sortedBy)[0] || ["amount", "descending"];
    return { by, order };
  }

  function getSortValue(account, by) {
    if (by === "date") {
      return new Date(account.created_on).getTime();
    }
    if (by === "amount") {
      return parseFloat(
        accountTotals[account.id] !== undefined
          ? accountTotals[account.id]
          : account.amount || 0
      );
    }
    if (by === "type") {
      const accountTypes = ["Bank Account", "Investment Account", "Hard Cash"];
      return accountTypes[account.type] || "";
    }
    return account[by] || "";
  }

  function sortAccounts(items, by, order) {
    return [...(items || [])].sort((a, b) => {
      const aValue = getSortValue(a, by);
      const bValue = getSortValue(b, by);

      if (typeof aValue === "string" || typeof bValue === "string") {
        return order === "ascending"
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue));
      }

      return order === "ascending" ? aValue - bValue : bValue - aValue;
    });
  }

  function sortShownAccounts(by) {
    if (!by) {
      return;
    }

    const currentOrder = sortedBy[by];
    const nextOrder = currentOrder === "ascending" ? "descending" : "ascending";
    setSortedBy({ [by]: nextOrder });
    setShownAccounts(sortAccounts(shownAccounts, by, nextOrder));
  }

  return (
    <div className={"accounts-wrapper__accounts-list"}>
      <div className={"mobile-account-type-toggle"}>
        <button
          className={accountTypeSelected === "active" ? "active" : ""}
          onClick={() => setAccountTypeSelected("active")}
        >
          Active
        </button>
        <button
          className={accountTypeSelected === "deleted" ? "active" : ""}
          onClick={() => setAccountTypeSelected("deleted")}
        >
          Deleted
        </button>
      </div>
      <div className={"header"}>
        <label
          className="header-date"
          onClick={() => sortShownAccounts("date")}
        >
          Date
        </label>
        <label className="header-name">Name</label>
        <label
          className="header-amount"
          onClick={() => sortShownAccounts("amount")}
        >
          Amount
        </label>
        <label
          className="header-type"
          onClick={() => sortShownAccounts("type")}
        >
          Type
        </label>
        <span className="header-actions-spacer" aria-hidden="true"></span>
      </div>
      <div className={"accounts"}>
        {shownAccounts?.length > 0 &&
          shownAccounts.map((account) => (
            <AccountItem
              key={account.id}
              account={account}
              refreshAccounts={refreshAccounts}
              accountTotal={accountTotals[account.id]}
              cashTotal={accountCashTotals[account.id]}
              holdingsTotal={accountHoldingTotals[account.id]}
            />
          ))}
      </div>
    </div>
  );
};

const AccountItem = ({
  account,
  refreshAccounts,
  accountTotal,
  cashTotal,
  holdingsTotal,
}) => {
  const global = useGlobalContext();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const accountTypes = [
    { source: `${process.env.PUBLIC_URL}/bank_icon.png`, name: "Bank Account" },
    {
      source: `${process.env.PUBLIC_URL}/investment_icon.png`,
      name: "Investment Account",
    },
    { source: `${process.env.PUBLIC_URL}/cash_icon.png`, name: "Hard Cash" },
  ];
  const showToast = useToast();
  const showConfirm = useConfirm();

  async function deleteAccount() {
    if (account.deleted) {
      showConfirm(`Remove ${account.name} from your records?`, async () => {
        await transactionService.deleteAccount(account.id);
        await refreshAccounts();
        showToast("Account removed", "info");
      });
    } else {
      showConfirm(`Delete ${account.name}?`, async () => {
        await transactionService.softDeleteAccount(account.id);
        await refreshAccounts();
        showToast("Account Deleted", "info");
      });
    }
  }

  function amountColor(amount) {
    let color = "#000";

    if (parseFloat(amount) == 0.0) {
      color = "gray";
    }
    if (parseFloat(amount) < 0) {
      color = "#fff";
    }

    return {
      color: color,
    };
  }

  function restoreAccount() {
    showConfirm(`Restore ${account.name}?`, async () => {
      await transactionService.restoreAccount(account.id);
      await refreshAccounts();
      showToast(`Account ${account.name} Restored.`, "info");
    });
  }

  const resolvedTotal =
    accountTotal !== undefined
      ? parseFloat(accountTotal)
      : parseFloat(account.amount || 0);
  const resolvedCashTotal =
    cashTotal !== undefined ? parseFloat(cashTotal) : parseFloat(0);
  const resolvedHoldingsTotal =
    holdingsTotal !== undefined ? parseFloat(holdingsTotal) : parseFloat(0);
  const sortedCashBalances = [...(account.cash_balances || [])].sort(
    (a, b) => parseFloat(b.balance || 0) - parseFloat(a.balance || 0)
  );
  const getHoldingAmount = (holding) =>
    holding.cost_basis !== null && holding.cost_basis !== undefined
      ? parseFloat(holding.cost_basis || 0)
      : parseFloat(holding.quantity || 0) *
        parseFloat(holding.average_cost || 0);
  const sortedHoldings = [...(account.holdings || [])].sort(
    (a, b) => getHoldingAmount(b) - getHoldingAmount(a)
  );

  return (
    <div className="account-item-wrapper">
      <div className="account-item">
        <label id="date" className="account-cell" data-label="Date">
          {new Date(account.created_on).toISOString().slice(0, 10)}
        </label>
        <label
          id="name"
          className="account-cell"
          data-label="Name"
          onClick={() => navigate(`/accounts/${account.id}`)}
        >
          {account.name.toLowerCase().includes("Revolut".toLowerCase()) && (
            <img
              alt="revolut_icon"
              width="15"
              height="18"
              src={process.env.PUBLIC_URL + "/revolut_icon.png"}
            />
          )}
          {account.name.toLowerCase().includes("Wise".toLowerCase()) && (
            <img
              alt="wise_icon"
              width="15"
              height="18"
              src={process.env.PUBLIC_URL + "/wise_icon.png"}
            />
          )}
          {account.name}
        </label>
        <label
          id="amount"
          className="account-cell"
          data-label="Amount"
          style={amountColor(helper.formatNumber(resolvedTotal))}
        >
          {helper.showOrMask(
            global.privacyMode,
            helper.formatNumber(resolvedTotal)
          )}{" "}
          {helper.getCurrency(global.globalCurrency)}
        </label>
        <label id="type" className="account-cell" data-label="Type">
          {
            <img
              alt="account_type"
              height="15"
              width="20"
              src={accountTypes[account.type]["source"]}
            />
          }
          {accountTypes[account.type]["name"]}
        </label>
        <div id="actions-wrapper">
          <button id="expand_button" onClick={() => setExpanded(!expanded)}>
            {expanded ? "▾" : "▸"}
          </button>
          {account.deleted && (
            <button id="restore_button" onClick={restoreAccount}>
              ⟳
            </button>
          )}
          <button id="remove_button" onClick={deleteAccount}>
            X
          </button>
        </div>
      </div>
      {expanded && (
        <div className="account-item-details">
          <div className="details-section">
            <div className="details-title">Cash balances</div>
            {sortedCashBalances.length > 0 ? (
              <>
                {sortedCashBalances.map((balance) => (
                  <div
                    className={`detail-row ${
                      Math.abs(parseFloat(balance.balance || 0)) <= 0.000001
                        ? "is-empty"
                        : ""
                    }`}
                    key={balance.id}
                  >
                    <span>{balance.currency?.code}</span>
                    <span>
                      {helper.showOrMask(
                        global.privacyMode,
                        helper.formatNumber(balance.balance)
                      )}{" "}
                      {helper.getCurrency(balance.currency?.code)}
                    </span>
                  </div>
                ))}
                <div className="detail-divider"></div>
                <div className="detail-row detail-total">
                  <span className="detail-total-spacer">.</span>
                  <span>
                    {helper.showOrMask(
                      global.privacyMode,
                      helper.formatNumber(resolvedCashTotal)
                    )}{" "}
                    {helper.getCurrency(global.globalCurrency)}
                  </span>
                </div>
              </>
            ) : (
              <div className="detail-row">No cash balances.</div>
            )}
          </div>
          <div className="details-section">
            <div className="details-title">Holdings</div>
            {sortedHoldings.length > 0 ? (
              <>
                {sortedHoldings.map((holding) => (
                  <div
                    className="detail-row holding-detail-row"
                    key={holding.id}
                  >
                    <span className="holding-label">
                      <span className="holding-quantity">
                        {helper.formatNumber(holding.quantity, 2)}
                      </span>
                      <span
                        className="security-ticker-tooltip"
                        data-tooltip={
                          holding.security?.name ||
                          holding.security?.description ||
                          holding.security?.ticker ||
                          "N/A"
                        }
                        title={
                          holding.security?.name ||
                          holding.security?.description ||
                          holding.security?.ticker ||
                          "N/A"
                        }
                      >
                        {holding.security?.ticker || "N/A"}
                      </span>
                    </span>
                    <span>
                      {helper.showOrMask(
                        global.privacyMode,
                        helper.formatNumber(getHoldingAmount(holding))
                      )}{" "}
                      {helper.getCurrency(holding.security?.currency?.code)}
                    </span>
                  </div>
                ))}
                <div className="detail-divider"></div>
                <div className="detail-row detail-total">
                  <span className="detail-total-spacer">.</span>
                  <span>
                    {helper.showOrMask(
                      global.privacyMode,
                      helper.formatNumber(resolvedHoldingsTotal)
                    )}{" "}
                    {helper.getCurrency(global.globalCurrency)}
                  </span>
                </div>
              </>
            ) : (
              <div className="detail-row">No holdings.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Accounts;
