import { React, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Formik, Form, Field } from "formik";
import transactionService from "../services/transactionService/transactionService";
import NoDataCard from "./core/nodata";
import "./accounts.scss";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { helper } from "./helper";
import { useGlobalContext } from "../context/GlobalContext";
import { validationSchemas } from "../validationSchemas";
import accountService from "../services/transactionService/accountService";
import currencyService from "../services/currencyService";

const Accounts = () => {
  const global = useGlobalContext();

  const [accounts, setAccounts] = useState(global.activeAccounts);
  const [accountTypeSelected, setAccountTypeSelected] = useState("active");
  const [accountTotalsData, setAccountTotalsData] = useState(null);

  useEffect(() => {
    setAccounts(global.activeAccounts);
  }, [global.activeAccounts]);

  useEffect(() => {
    let active = true;

    async function fetchAccountTotals() {
      const totals = await accountService.getAccountTotals(
        global.globalCurrency
      );
      if (active) {
        setAccountTotalsData(totals);
      }
    }

    if (global.accounts != null) {
      fetchAccountTotals();
    }
    return () => {
      active = false;
    };
  }, [global.accounts, global.globalCurrency]);

  return (
    <div className={"accounts-wrapper"}>
      <Sidebar
        totals={accountTotalsData}
        refreshAccounts={global.updateAccounts}
      />
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
          totals={accountTotalsData}
        />
      )}
    </div>
  );
};

const Sidebar = ({ totals, refreshAccounts }) => {
  const global = useGlobalContext();
  const [investments, setInvestments] = useState(0);
  const [cash, setCash] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);
  const [cashBreakdown, setCashBreakdown] = useState({
    cash_balances: 0,
    hard_cash: 0,
  });
  const [investmentsByAssetClass, setInvestmentsByAssetClass] = useState([]);

  useEffect(() => {
    if (!totals?.summary) {
      return;
    }

    setCash(parseFloat(totals.summary.cash || 0));
    setInvestments(parseFloat(totals.summary.investments || 0));
    setTotalAssets(parseFloat(totals.summary.total_assets || 0));
    setCashBreakdown({
      cash_balances: parseFloat(
        totals.summary.cash_breakdown?.cash_balances || 0
      ),
      hard_cash: parseFloat(totals.summary.cash_breakdown?.hard_cash || 0),
    });
    setInvestmentsByAssetClass(totals.summary.investments_by_asset_class || []);
  }, [totals]);

  const SummaryAmount = ({ value, strong = false }) => {
    const content = (
      <>
        {helper.showOrMask(global.privacyMode, helper.formatNumber(value))}{" "}
        {helper.getCurrency(global.globalCurrency)}
      </>
    );
    return strong ? <b>{content}</b> : <small>{content}</small>;
  };

  return (
    <div className={"accounts-wrapper__sidebar"}>
      <CreateAccount refreshAccounts={refreshAccounts} />
      <div className={"accounts-info"}>
        <div className={"card-label"}>Summary</div>
        <div className="summary-section">
          <div className="summary-section-title">
            <span>
              <img
                alt="investments"
                src={process.env.PUBLIC_URL + "/investment_icon.png"}
                width="20"
                height="17"
              />
              Investments
            </span>
            <SummaryAmount value={investments} strong />
          </div>
          {investmentsByAssetClass.length > 0 ? (
            investmentsByAssetClass.map((row) => (
              <div className="summary-sub-row" key={row.asset_class}>
                <span>{row.label}</span>
                <SummaryAmount value={parseFloat(row.amount || 0)} />
              </div>
            ))
          ) : (
            <div className="summary-sub-row is-empty">
              <span>No investments</span>
              <SummaryAmount value={0} />
            </div>
          )}
        </div>
        <div className="summary-section">
          <div className="summary-section-title">
            <span>
              <img
                alt="cash"
                src={process.env.PUBLIC_URL + "/cash_icon.png"}
                width="20"
                height="17"
              />
              Cash
            </span>
            <SummaryAmount value={cash} strong />
          </div>
          <div className="summary-sub-row">
            <span>Cash balances</span>
            <SummaryAmount value={cashBreakdown.cash_balances} />
          </div>
          <div className="summary-sub-row">
            <span>Hard cash</span>
            <SummaryAmount value={cashBreakdown.hard_cash} />
          </div>
        </div>
        <div className="summary-total-row">
          <span>Total</span>
          <b>
            {helper.showOrMask(
              global.privacyMode,
              helper.formatNumber(totalAssets)
            )}{" "}
            {helper.getCurrency(global.globalCurrency)}
          </b>
        </div>
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
  totals,
}) => {
  const global = useGlobalContext();
  const [sortedBy, setSortedBy] = useState({ amount: "descending" });
  const [shownAccounts, setShownAccounts] = useState(accounts);
  const [accountTotals, setAccountTotals] = useState({});
  const [accountCashTotals, setAccountCashTotals] = useState({});
  const [accountHoldingTotals, setAccountHoldingTotals] = useState({});

  useEffect(() => {
    const totalsByAccount = {};
    const cashTotalsByAccount = {};
    const holdingsTotalsByAccount = {};
    Object.entries(totals?.accounts || {}).forEach(([accountId, values]) => {
      totalsByAccount[accountId] = values.total;
      cashTotalsByAccount[accountId] = values.cash_total;
      holdingsTotalsByAccount[accountId] = values.holdings_total;
    });
    setAccountTotals(totalsByAccount);
    setAccountCashTotals(cashTotalsByAccount);
    setAccountHoldingTotals(holdingsTotalsByAccount);
  }, [totals]);

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
  const [holdingTotals, setHoldingTotals] = useState({
    invested: null,
    market: null,
    hasMissingMarketPrices: false,
  });
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
  const getHoldingMarketValue = (holding) =>
    holding.market_value !== null && holding.market_value !== undefined
      ? parseFloat(holding.market_value || 0)
      : holding.latest_price?.price !== null &&
        holding.latest_price?.price !== undefined
      ? parseFloat(holding.quantity || 0) *
        parseFloat(holding.latest_price.price || 0)
      : null;
  const getHoldingUnrealizedGain = (holding) => {
    if (
      holding.unrealized_gain !== null &&
      holding.unrealized_gain !== undefined
    ) {
      return parseFloat(holding.unrealized_gain || 0);
    }
    const marketValue = getHoldingMarketValue(holding);
    if (marketValue === null) {
      return null;
    }
    return marketValue - getHoldingAmount(holding);
  };
  const sortedHoldings = [...(account.holdings || [])].sort(
    (a, b) => getHoldingAmount(b) - getHoldingAmount(a)
  );

  useEffect(() => {
    let active = true;

    async function convertHoldingTotals() {
      if (!expanded || sortedHoldings.length === 0) {
        setHoldingTotals({
          invested: null,
          market: null,
          hasMissingMarketPrices: false,
        });
        return;
      }

      try {
        const convertedRows = await Promise.all(
          sortedHoldings.map(async (holding) => {
            const currency = holding.security?.currency?.code;
            const costBasis = getHoldingAmount(holding);
            const marketValue = getHoldingMarketValue(holding);
            const invested = currency
              ? await currencyService.convert(
                  currency,
                  global.globalCurrency,
                  costBasis
                )
              : costBasis;
            const market =
              marketValue !== null && currency
                ? await currencyService.convert(
                    currency,
                    global.globalCurrency,
                    marketValue
                  )
                : marketValue;

            return { invested, market };
          })
        );

        if (!active) {
          return;
        }

        setHoldingTotals({
          invested: convertedRows.reduce(
            (sum, row) => sum + parseFloat(row.invested || 0),
            0
          ),
          market: convertedRows.reduce(
            (sum, row) =>
              row.market === null ? sum : sum + parseFloat(row.market || 0),
            0
          ),
          hasMissingMarketPrices: convertedRows.some(
            (row) => row.market === null
          ),
        });
      } catch (error) {
        console.error("Failed to convert holding totals", error);
        if (active) {
          setHoldingTotals({
            invested: null,
            market: null,
            hasMissingMarketPrices: false,
          });
        }
      }
    }

    convertHoldingTotals();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, account.holdings, global.globalCurrency]);

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
                    <span className="holding-values">
                      <span className="holding-cost-value">
                        {helper.showOrMask(
                          global.privacyMode,
                          helper.formatNumber(getHoldingAmount(holding))
                        )}{" "}
                        {helper.getCurrency(holding.security?.currency?.code)}
                      </span>
                      <span className="holding-market-value">
                        {getHoldingMarketValue(holding) !== null
                          ? helper.showOrMask(
                              global.privacyMode,
                              helper.formatNumber(
                                getHoldingMarketValue(holding)
                              )
                            )
                          : "N/A"}{" "}
                        {getHoldingMarketValue(holding) !== null &&
                          helper.getCurrency(holding.security?.currency?.code)}
                      </span>
                      {getHoldingUnrealizedGain(holding) !== null && (
                        <span
                          className={`holding-gain ${
                            getHoldingUnrealizedGain(holding) >= 0
                              ? "is-positive"
                              : "is-negative"
                          }`}
                        >
                          {helper.showOrMask(
                            global.privacyMode,
                            `${
                              getHoldingUnrealizedGain(holding) >= 0 ? "+" : ""
                            }${helper.formatNumber(
                              getHoldingUnrealizedGain(holding)
                            )}`
                          )}{" "}
                          {helper.getCurrency(holding.security?.currency?.code)}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
                <div className="detail-divider"></div>
                <div className="detail-row detail-total holding-detail-row">
                  <span className="detail-total-spacer">.</span>
                  <span className="holding-values">
                    <span className="holding-cost-value">
                      {helper.showOrMask(
                        global.privacyMode,
                        helper.formatNumber(holdingTotals.invested || 0)
                      )}{" "}
                      {helper.getCurrency(global.globalCurrency)}
                    </span>
                    <span
                      className="holding-market-value"
                      title={
                        holdingTotals.hasMissingMarketPrices
                          ? "Some holdings do not have a latest price."
                          : ""
                      }
                    >
                      {helper.showOrMask(
                        global.privacyMode,
                        helper.formatNumber(
                          holdingTotals.market !== null
                            ? holdingTotals.market
                            : resolvedHoldingsTotal
                        )
                      )}{" "}
                      {helper.getCurrency(global.globalCurrency)}
                      {holdingTotals.hasMissingMarketPrices ? "*" : ""}
                    </span>
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
