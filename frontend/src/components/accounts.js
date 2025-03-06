import { React, useState, useEffect } from "react";
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
      <Sidebar
        accounts={accounts}
        refreshAccounts={global.updateAccounts}
        accountTypeSelected={accountTypeSelected}
        setAccountTypeSelected={setAccountTypeSelected}
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
        />
      )}
    </div>
  );
};

const Sidebar = ({
  accounts,
  refreshAccounts,
  accountTypeSelected,
  setAccountTypeSelected,
}) => {
  const global = useGlobalContext();
  const [investments, setInvestments] = useState(0);
  const [bankAssets, setBankAssets] = useState(0);
  const [cash, setCash] = useState(0);
  const [networth, setNetworth] = useState(0);

  useEffect(() => {
    if (investments || cash || bankAssets) {
      const c = parseFloat(cash);
      const b = parseFloat(bankAssets);
      const i = parseFloat(investments);

      let total = parseFloat(c + b + i).toFixed(2);
      setNetworth(total);
    }
  }, [investments, cash, bankAssets]);

  useEffect(() => {
    if (accounts == null) {
      return;
    }
    async function convertInvestments() {
      let promises = accounts?.map(async (a) => {
        if (a.type == 1) {
          return await currencyService.convert(
            a.currency,
            global.globalCurrency,
            a.amount
          );
        }
        return 0;
      });

      let results = await Promise.all(promises);
      let total = results.reduce((acc, curr) => acc + parseFloat(curr), 0);
      setInvestments(total);
    }
    async function convertCash() {
      let promises = accounts?.map(async (a) => {
        if (a.type == 2) {
          return await currencyService.convert(
            a.currency,
            global.globalCurrency,
            a.amount
          );
        }
        return 0;
      });
      let results = await Promise.all(promises);
      let total = results.reduce((acc, curr) => acc + parseFloat(curr), 0);
      setCash(total);
    }
    async function convertBankAssets() {
      let promises = accounts?.map(async (a) => {
        if (a.type == 0) {
          return await currencyService.convert(
            a.currency,
            global.globalCurrency,
            a.amount
          );
        }
        return 0;
      });

      let results = await Promise.all(promises);
      let total = results.reduce((acc, curr) => acc + parseFloat(curr), 0);
      setBankAssets(total);
    }

    convertInvestments();
    convertCash();
    convertBankAssets();
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
          <span>Hard cash: </span>
          <small>
            {helper.showOrMask(global.privacyMode, helper.formatNumber(cash))}
            {helper.getCurrency(global.globalCurrency)}
          </small>
        </label>
        <label>
          {
            <img
              alt="account-type"
              src={process.env.PUBLIC_URL + "/bank_icon.png"}
              width="20"
              height="17"
              style={{ marginRight: "10px" }}
            />
          }
          <span>Money in banks: </span>
          <small>
            {helper.showOrMask(
              global.privacyMode,
              helper.formatNumber(bankAssets)
            )}{" "}
            {helper.getCurrency(global.globalCurrency)}
          </small>
        </label>
        <label>
          <span>
            <b>TOTAL ASSETS:</b>{" "}
          </span>
          <b style={{ borderBottom: "2px solid #5F9EA0" }}>
            {helper.showOrMask(
              global.privacyMode,
              helper.formatNumber(networth)
            )}{" "}
            {helper.getCurrency(global.globalCurrency)}
          </b>
        </label>
      </div>
      <div id="account-types-wrapper">
        <div className={"card-label"}>More</div>
        <div>
          <input
            type="radio"
            id="active_accounts"
            name="account-type"
            checked={accountTypeSelected === "active"}
            onChange={() => setAccountTypeSelected("active")}
          />
          <label htmlFor="active_accounts">Active Accounts</label>
        </div>
        <div>
          <input
            type="radio"
            id="deleted_accounts"
            name="account-type"
            checked={accountTypeSelected === "deleted"}
            onChange={() => setAccountTypeSelected("deleted")}
          />
          <label htmlFor="deleted_accounts">Deleted Accounts</label>
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
          amount: "",
          name: "",
          currency: "",
          type: "",
        }}
        validationSchema={validationSchemas.accountsFormSchema}
        validateOnChange={false}
        validateOnBlur={false}
        onSubmit={(values, { setSubmitting, resetForm, validateForm }) => {
          validateForm().then(async () => {
            await transactionService.addAccount(values);
            await refreshAccounts();
            showToast("Account Created", "success");
            setSubmitting(false);
            resetForm();
          });
        }}
      >
        {({ errors, touched }) => (
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
            <Field as="select" name="currency">
              <option value="" disabled hidden>
                Select currency
              </option>
              {currencies.map((type, index) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Field>
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
            <button type="submit" id="submit-button">
              Add Account
            </button>
            {errors.name && touched.name ? <span>{errors.name}</span> : null}
            {errors.currency && touched.currency ? (
              <span>{errors.currency}</span>
            ) : null}
            {errors.type && touched.type ? <span>{errors.type}</span> : null}
            {errors.amount && touched.amount ? (
              <span>{errors.amount}</span>
            ) : null}
          </Form>
        )}
      </Formik>
    </div>
  );
};

const AccountsList = ({ accounts, refreshAccounts, accountTypeSelected }) => {
  const global = useGlobalContext();
  const [sortedBy, setSortedBy] = useState({});
  const [showEmptyAccounts, setShowEmptyAccounts] = useState(false);
  const [shownAccounts, setShownAccounts] = useState(accounts);

  useEffect(() => {
    filterAccounts();
  }, [showEmptyAccounts, accounts]);

  async function sortShownAccounts(by) {
    if (!by) {
      return;
    }

    let sorted = null;

    const sortKeyFunction = {
      date: (acc) => new Date(acc.created_on),
      amount: async (acc) => {
        const convertedAmount = await currencyService.convert(
          acc.currency,
          global.globalCurrency,
          acc.amount
        );
        return parseFloat(convertedAmount);
      },
    };
    const transform = sortKeyFunction[by] || ((acc) => acc[by]);

    const itemsWithTransformedValues = await Promise.all(
      shownAccounts.map(async (acc) => ({
        ...acc,
        transformedValue:
          by === "amount" ? await transform(acc) : transform(acc),
      }))
    );

    if (by in sortedBy) {
      const currentOrder = sortedBy[by];
      // Perform synchronous sorting on the transformed values
      sorted = itemsWithTransformedValues.sort((a, b) =>
        currentOrder === "ascending"
          ? b.transformedValue - a.transformedValue
          : a.transformedValue - b.transformedValue
      );
      setSortedBy({
        [by]: currentOrder === "ascending" ? "descending" : "ascending",
      });
    } else {
      sorted = itemsWithTransformedValues.sort(
        (a, b) => a.transformedValue - b.transformedValue
      );
      setSortedBy({ [by]: "ascending" });
    }
    setShownAccounts(sorted);
  }

  function filterAccounts() {
    let filtered_accounts = accounts;
    if (!showEmptyAccounts) {
      filtered_accounts = accounts.filter((a) => a.amount != 0);
    }

    setShownAccounts(filtered_accounts);
  }

  function handleEmptyAccounts() {
    setShowEmptyAccounts(!showEmptyAccounts);
  }

  return (
    <div className={"accounts-wrapper__accounts-list"}>
      {accountTypeSelected === "active" && (
        <div className={"extra_filters"}>
          <label className={"empty_accounts_checkbox"}>
            <input
              type="checkbox"
              checked={showEmptyAccounts}
              onChange={handleEmptyAccounts}
            />
            <span>Empty Accounts</span>
          </label>
        </div>
      )}
      <div className={"header"}>
        <label onClick={() => sortShownAccounts("date")}>Date</label>
        <label>Name</label>
        <label onClick={() => sortShownAccounts("amount")}>Amount</label>
        <label onClick={() => sortShownAccounts("type")}>Type</label>
      </div>
      <div className={"accounts"}>
        {accountTypeSelected === "deleted"
          ? global.accounts
              ?.filter((a) => a.deleted)
              .map((account) => (
                <AccountItem
                  key={account.id}
                  account={account}
                  refreshAccounts={refreshAccounts}
                />
              ))
          : shownAccounts?.length > 0 &&
            shownAccounts.map((account) => (
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
  const global = useGlobalContext();
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

  return (
    <div className="account-item">
      <label id="date">
        {new Date(account.created_on).toISOString().slice(0, 10)}
      </label>
      <label id="name">
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
        style={amountColor(helper.formatNumber(account.amount))}
      >
        {helper.showOrMask(
          global.privacyMode,
          helper.formatNumber(account.amount)
        )}{" "}
        {helper.getCurrency(account.currency)}
      </label>
      <label id="type">
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
  );
};

export default Accounts;
