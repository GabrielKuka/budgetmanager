import { useEffect, useState } from "react";
import { useGlobalContext } from "../context/GlobalContext";
import "./accountPage.scss";
import { useParams } from "react-router-dom";
import { Navigate } from "react-router-dom";
import NotFound from "./notfound";
import { helper } from "./helper";

const AccountPage = () => {
  const { id } = useParams();
  const global = useGlobalContext();
  const account = getAccountObject(id);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    function getAccountTransactions() {
      const expenses = global.expenses.filter((e) => e.account == id);
      const incomes = global.incomes.filter((e) => e.account == id);

      const result = expenses.concat(incomes);
      setTransactions(result);
    }

    getAccountTransactions();
  }, []);

  if (!global.authToken) {
    return <Navigate push to="/login" />;
  }

  const invalidAccount = account === "Not Found";
  if (invalidAccount) {
    return <NotFound />;
  }

  const notMyAccount = global.user?.data?.id !== account?.user;
  if (notMyAccount) {
    return <NotFound />;
  }

  function getAccountObject(id) {
    const account = global.accounts?.filter((a) => a.id === parseInt(id));
    if (account?.length === 1) {
      return account[0];
    }

    return "Not Found";
  }

  const accountTypes = ["Bank Account", "Investment Account", "Hard Cash"];

  return (
    <div className={"account-page-wrapper"}>
      <Sidebar account={account} accountType={accountTypes[account.type]} />
      <MainContainer
        account={account}
        accountType={accountTypes[account.type]}
        transactions={transactions}
      />
    </div>
  );
};

const Sidebar = ({ account, accountType }) => {
  return (
    <div className={"account-page-wrapper__sidebar"}>
      <div id="account_information">
        <div className={"card-label"}>{accountType}</div>
        <div className="grid-container">
          <div className="grid-row">
            <label>Name: </label>
            <span>{account.name}</span>
          </div>
          <div className="grid-row">
            <label>Currency: </label>
            <span>{account.currency}</span>
          </div>
          <div className="grid-row">
            <label>Type: </label>
            <span>{accountType}</span>
          </div>
          <div className="grid-row">
            <label>Active: </label>
            <span>{account.deleted ? "No" : "Yes"}</span>
          </div>
          <div className="grid-row">
            <label>Balance: </label>
            <span>
              {helper.formatNumber(account.amount)}{" "}
              {helper.getCurrency(account.currency)}
            </span>
          </div>
          <div className="grid-row">
            <label>Created On: </label>
            <span>{new Date(account.created_on).toLocaleString()}</span>
          </div>
          <div className="grid-row">
            <label>Last activity: </label>
            <span>{new Date(account.updated_on).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const MainContainer = ({ account, accountType, transactions }) => {
  const [sortedBy, setSortedBy] = useState({});

  function sortShownTransactions(by = "") {}

  return (
    <div className={"main-container"}>
      <div className="transactions-list">
        <div className="header">
          <div>
            <label onClick={() => sortShownTransactions("date")}>Date:</label>
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
            <label onClick={() => sortShownTransactions("amount")}>
              Amount
            </label>
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

          <div>
            <label onClick={() => sortShownTransactions("category")}>
              Category:
            </label>
            {sortedBy["category"] == "ascending" && (
              <img
                src={`${process.env.PUBLIC_URL}/up_arrow_icon.png`}
                width="12"
                height="12"
              />
            )}
            {sortedBy["category"] == "descending" && (
              <img
                src={`${process.env.PUBLIC_URL}/down_arrow_icon.png`}
                width="12"
                height="12"
              />
            )}
          </div>
        </div>
        <div className="content">
          {transactions.length > 0 &&
            transactions.map((t) => <TransactionItem></TransactionItem>)}
        </div>
      </div>
    </div>
  );
};

const TransactionItem = () => {
  return <div></div>;
};

export default AccountPage;
