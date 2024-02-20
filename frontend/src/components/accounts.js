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

const Accounts = () => {
  const global = useGlobalContext();

  const [accounts, setAccounts] = useState(global.accounts);

  useEffect(() => {
    setAccounts(global.accounts);
  }, [global.accounts]);

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
        />
      )}
    </div>
  );
};

const Sidebar = ({ accounts, refreshAccounts }) => {
  const [investments, setInvestments] = useState("");
  const [bankAssets, setBankAssets] = useState("");
  const [cash, setCash] = useState("");
  const [networth, setNetworth] = useState("");

  useEffect(() => {
    if (investments != "" && bankAssets != "" && cash != "") {
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
          return await currencyService.convert(a.currency, "EUR", a.amount);
        }
        return 0;
      });

      let results = await Promise.all(promises);
      let total = results.reduce((acc, curr) => acc + parseFloat(curr), 0);
      setInvestments(total.toFixed(2));
    }
    async function convertCash() {
      let promises = accounts?.map(async (a) => {
        if (a.type == 2) {
          return await currencyService.convert(a.currency, "EUR", a.amount);
        }
        return 0;
      });
      let results = await Promise.all(promises);
      let total = results.reduce((acc, curr) => acc + parseFloat(curr), 0);
      setCash(total.toFixed(2));
    }
    async function convertBankAssets() {
      let promises = accounts?.map(async (a) => {
        if (a.type == 0) {
          return await currencyService.convert(a.currency, "EUR", a.amount);
        }
        return 0;
      });

      let results = await Promise.all(promises);
      let total = results.reduce((acc, curr) => acc + parseFloat(curr), 0);
      setBankAssets(total.toFixed(2));
    }

    convertInvestments();
    convertCash();
    convertBankAssets();
  }, [accounts]);

  function getAccountCurrency(id) {
    const account = accounts.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

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
          <small>{investments} €</small>
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
          <small>{cash} €</small>
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
          <small>{bankAssets} €</small>
        </label>
        <label>
          <span>
            <b>TOTAL ASSETS:</b>{" "}
          </span>
          <b style={{ borderBottom: "2px solid #5F9EA0" }}>{networth} €</b>
        </label>
      </div>
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

const AccountsList = ({ accounts, refreshAccounts }) => {
  const [showEmptyAccounts, setShowEmptyAccounts] = useState(false);
  const [shownAccounts, setShownAccounts] = useState(accounts);

  useEffect(() => {
    filterAccounts();
  }, [showEmptyAccounts, accounts]);

  function sortShownAccounts(by) {
    let sortedAccounts = shownAccounts;
    switch (by) {
      case "name":
        sortedAccounts = shownAccounts.sort((a, b) =>
          a.name >= b.name ? 1 : -1
        );
        break;
      case "type":
        sortedAccounts = shownAccounts.sort((a, b) =>
          a.type >= b.type ? 1 : -1
        );
        break;
      case "amount":
        sortedAccounts = shownAccounts.sort((a, b) =>
          a.amount <= b.amount ? 1 : -1
        );
        break;
    }
    setShownAccounts([...sortedAccounts]);
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
      <div className={"header"}>
        <label>Date</label>
        <label onClick={() => sortShownAccounts("name")}>Name</label>
        <label onClick={() => sortShownAccounts("amount")}>Amount</label>
        <label onClick={() => sortShownAccounts("type")}>Type</label>
      </div>
      <div className={"accounts"}>
        {shownAccounts?.length > 0 &&
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
    showConfirm(`Delete ${account.name}?`, async () => {
      await transactionService.deleteAccount(account.id);
      await refreshAccounts();
      showToast("Account Deleted", "info");
    });
  }

  function amountColor(amount) {
    let color = "#000";

    if (parseInt(amount) == 0) {
      color = "gray";
    }
    if (parseFloat(amount) < 0) {
      color = "#fff";
    }

    return {
      color: color,
    };
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
      <label id="amount" style={amountColor(account.amount)}>
        {parseFloat(account.amount).toFixed(2)}{" "}
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
      <button onClick={deleteAccount}>X</button>
    </div>
  );
};

export default Accounts;
