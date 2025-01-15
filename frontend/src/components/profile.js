import { React, useEffect, useState } from "react";
import userService from "../services/userService";
import { Link } from "react-router-dom";
import { helper } from "./helper";
import "./profile.scss";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import TransactionPopup from "./core/transaction_popup";
import Stats from "./stats/stats";

import * as XLSX from "xlsx";
import { useGlobalContext } from "../context/GlobalContext";
import currencyService from "../services/currencyService";
import transactionService from "../services/transactionService/transactionService";

const Profile = () => {
  const global = useGlobalContext();
  const [userData, setUserData] = useState("");
  const [expenseCategories, setExpenseCategories] = useState(
    global.expenseCategories
  );
  const [incomeCategories, setIncomeCategories] = useState(
    global.incomeCategories
  );
  const [accounts, setAccounts] = useState(global.activeAccounts);

  const [incomes, setIncomes] = useState(global.incomes);
  const [expenses, setExpenses] = useState(global.expenses);
  const [transfers, setTransfers] = useState(global.transfers);

  const [transactionPopup, setTransactionPopup] = useState(false);

  useEffect(() => {
    getUserData();
  }, []);

  useEffect(() => {
    setAccounts(global.activeAccounts);
  }, [global.activeAccounts]);

  useEffect(() => {
    setIncomeCategories(global.incomeCategories);
  }, [global.incomeCategories]);

  useEffect(() => {
    setExpenseCategories(global.expenseCategories);
  }, [global.expenseCategories]);

  useEffect(() => {
    const incomes = global.incomes?.sort((a, b) => (a.date > b.date ? -1 : 1));
    setIncomes(incomes);
  }, [global.incomes]);

  useEffect(() => {
    const expenses = global.expenses?.sort((a, b) =>
      a.date > b.date ? -1 : 1
    );
    setExpenses(expenses);
  }, [global.expenses]);

  useEffect(() => {
    const transfers = global.transfers?.sort((a, b) =>
      a.date > b.date ? -1 : 1
    );
    setTransfers(transfers);
  }, [global.transfers]);

  async function getUserData() {
    const response = await userService.getUserData();
    setUserData(response);
  }

  function getAccountCurrency(id) {
    const account = global.accounts.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  return (
    <div className={"profile-wrapper"}>
      <Sidebar
        userData={userData}
        accounts={accounts}
        expenses={expenses}
        incomes={incomes}
        transfers={transfers}
        global={global}
      />
      <div className={"profile-wrapper__board"}>
        <Stats />

        <RecentExpenses
          expenses={expenses}
          accounts={accounts}
          categories={expenseCategories}
          setTransactionPopup={setTransactionPopup}
        />
        <RecentIncomes
          incomes={incomes}
          accounts={accounts}
          categories={incomeCategories}
          setTransactionPopup={setTransactionPopup}
        />
        <RecentTransfers
          transfers={transfers}
          accounts={accounts}
          setTransactionPopup={setTransactionPopup}
        />
        {transactionPopup && (
          <TransactionPopup
            transaction={transactionPopup}
            showPopup={setTransactionPopup}
            getAccountCurrency={getAccountCurrency}
            refreshTransactions={global.updateTransactions}
          />
        )}
      </div>
    </div>
  );
};

const Sidebar = (props) => {
  const showConfirm = useConfirm();
  const showToast = useToast();
  const global = useGlobalContext();
  const [totalWealth, setTotalWealth] = useState({ wealth: null, change: 0 });

  useEffect(() => {
    async function getTotalWealth() {
      let promises = global.activeAccounts?.map(async (a) => {
        return await currencyService.convert(
          a.currency,
          global.globalCurrency,
          a.amount
        );
      });

      const results = await Promise.all(promises);
      const total = results.reduce((acc, curr) => acc + parseFloat(curr), 0);

      setTotalWealth((prev) => ({ ...prev, wealth: total }));
    }
    getTotalWealth();
  }, [global.globalCurrency]);

  useEffect(() => {
    async function getPercentageChange() {
      if (totalWealth.wealth == null) {
        return 0;
      }

      const now = new Date();
      const previousMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const previousYear =
        now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

      const firstDay = new Date(previousYear, previousMonth, 1);
      const lastDay = new Date(previousYear, previousMonth + 1, 0);

      const dateRange = {
        from: firstDay,
        to: lastDay,
      };
      // Get expenses and incomes from the previous month
      const data = await transactionService.getTransactions(dateRange);
      const previousMonthExpenses = data.expenses;
      const previousMonthIncomes = data.incomes;

      async function getSumOfTransactions(transactions) {
        let promises = transactions?.map(async (t) => {
          return await currencyService.convert(
            getAccountCurrency(t.account),
            global.globalCurrency,
            t.amount
          );
        });
        if (!promises) {
          return;
        }
        const results = await Promise.all(promises);
        const total = results.reduce((acc, curr) => acc + parseFloat(curr), 0);

        return parseFloat(total);
      }

      const totalPrevMonthExpenses = await getSumOfTransactions(
        previousMonthExpenses
      );
      const totalPrevMonthIncomes = await getSumOfTransactions(
        previousMonthIncomes
      );

      const netChange = parseFloat(
        totalPrevMonthIncomes - totalPrevMonthExpenses
      );
      const previousTotalWealth = parseFloat(
        parseFloat(totalWealth.wealth) - netChange
      );

      const percentageChange = parseFloat(
        ((totalWealth.wealth - previousTotalWealth) / previousTotalWealth) * 100
      );
      setTotalWealth((prev) => ({ ...prev, change: percentageChange }));
    }

    getPercentageChange();
  }, [totalWealth.wealth]);

  function getAccountCurrency(id) {
    const account = global.accounts?.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  function exportData() {
    showConfirm("Download all data in Excel? ", async () => {
      const wb = XLSX.utils.book_new();

      const expensesSheet = XLSX.utils.json_to_sheet(props.expenses);
      const incomesSheet = XLSX.utils.json_to_sheet(props.incomes);
      const transfersSheet = XLSX.utils.json_to_sheet(props.transfers);
      const accountsSheet = XLSX.utils.json_to_sheet(props.accounts);
      const userSheet = XLSX.utils.json_to_sheet([props.userData]);

      XLSX.utils.book_append_sheet(wb, accountsSheet, "Accounts");
      XLSX.utils.book_append_sheet(wb, userSheet, "User");
      XLSX.utils.book_append_sheet(wb, expensesSheet, "Expenses");
      XLSX.utils.book_append_sheet(wb, incomesSheet, "Incomes");
      XLSX.utils.book_append_sheet(wb, transfersSheet, "Transfers");

      XLSX.writeFile(wb, "budgetmanager.xlsx");
      showToast("Data downloaded", "info");
    });
  }

  function deleteAccount() {
    showConfirm(
      "Are you sure you want to delete your account with all your data?",
      async () => {
        const result = await userService.deleteUser(global.user.data.email);
        if (result) {
          showToast("Deleted.");
          global.logoutUser();
        } else {
          showToast("Error deleting user.", "error");
        }
      }
    );
  }

  return (
    <div className={"profile-wrapper__sidebar"}>
      <div className={"user-data"}>
        <img alt="user-icon" src={process.env.PUBLIC_URL + "/user-icon.png"} />
        <div>
          <div>
            <span>Full name </span>
            <label>{props.userData.name}</label>
          </div>
          <div>
            <span>Email </span>
            <label>{props.userData.email}</label>
          </div>
          <div>
            <span>Phone </span>
            <label>{props.userData.phone}</label>
          </div>
          <div>
            <span>Total Wealth</span>
            <label>
              {helper.showOrMask(
                global.privacyMode,
                helper.formatNumber(parseFloat(totalWealth.wealth).toFixed(2))
              )}{" "}
              {helper.getCurrency(global.globalCurrency)}{" "}
              <span
                style={{
                  fontSize: "12px",
                  color: `${
                    parseFloat(totalWealth.change) > 0 ? "green" : "red"
                  }`,
                }}
                id="percent_wealth_change"
                onMouseOver={() =>
                  (document.getElementById(
                    "wealth_change_tooltip"
                  ).style.visibility = "visible")
                }
                onMouseOut={() =>
                  (document.getElementById(
                    "wealth_change_tooltip"
                  ).style.visibility = "hidden")
                }
              >
                <i>
                  {parseFloat(totalWealth.change) > 0 ? "+" : ""}
                  {parseFloat(totalWealth.change).toFixed(2)}%
                </i>{" "}
              </span>
              {parseFloat(totalWealth.change).toFixed(2) !== "0.00" && (
                <img
                  src={
                    process.env.PUBLIC_URL +
                    `/${
                      parseFloat(totalWealth.change) > 0
                        ? "increase"
                        : "decrease"
                    }.png`
                  }
                  style={{
                    height: "16px",
                    width: "16px",
                    verticalAlign: "-3px",
                    marginLeft: "-5px",
                  }}
                />
              )}
              <span id="wealth_change_tooltip">
                Your total net worth has
                {parseFloat(totalWealth.change) == 0
                  ? " remained the same "
                  : `${
                      parseFloat(totalWealth.change) > 0
                        ? ` increased ${helper
                            .formatNumber(totalWealth.change)
                            .replace(/[+-]/g, "")}% `
                        : ` decreased ${helper
                            .formatNumber(totalWealth.change)
                            .replace(/[+-]/g, "")}% `
                    }`}
                from the previous month.
              </span>
            </label>
          </div>
        </div>
      </div>
      <hr />
      <div className={"accounts-glimpse"}>
        <div className={"header"}>
          <label className={"main-title"}>Accounts:</label>
          <Link className={"more-link"} to="/accounts">
            More Accounts
          </Link>
        </div>
        <div className={"accounts-list"}>
          {props.accounts?.length > 0 &&
            props.accounts
              ?.filter((a) => a.amount > 0)
              .slice(0, 5)
              ?.map((a) => (
                <div key={a.id} className={"account-item"}>
                  <label className={"name"}>{a.name}</label>
                  <label className={"amount"}>
                    {helper.showOrMask(
                      props.global.privacyMode,
                      parseFloat(a.amount).toFixed(2)
                    )}{" "}
                    {helper.getCurrency(getAccountCurrency(a.id))}
                  </label>
                </div>
              ))}
        </div>
      </div>
      <div className={"download-data"} onClick={exportData}>
        <img
          src={process.env.PUBLIC_URL + "/download_icon.png"}
          alt="download_icon"
          height="20"
          width="20"
          className={"download-icon"}
        />
        <span>Export data in Excel</span>
        <img
          src={process.env.PUBLIC_URL + "/excel_icon.png"}
          alt="excel_icon"
          height="20"
          width="20"
        />
      </div>
      <button id="delete-account-btn" onClick={deleteAccount}>
        🚫 Delete Account
      </button>
    </div>
  );
};

const RecentExpenses = (props) => {
  if (props.expenses && props.expenses.length == 0) {
    return <NoRecentTransactionCard transaction_type={"expenses"} />;
  }
  return (
    <div className={"expenses"}>
      <div className={"header"}>
        <label className={"main-title"}>Recent Expenses:</label>

        <Link className={"more-link"} to="/dashboard/expenses">
          More Expenses
        </Link>
      </div>
      {props.expenses?.length > 0 &&
        props.expenses
          .slice(0, 5)
          .map((expense) => (
            <ExpenseItem
              key={expense.id}
              expense={expense}
              accounts={props.accounts}
              categories={props.categories}
              setTransactionPopup={props.setTransactionPopup}
            />
          ))}
    </div>
  );
};

const ExpenseItem = ({
  expense,
  accounts,
  categories,
  setTransactionPopup,
}) => {
  const global = useGlobalContext();
  function getExpenseCategory(id) {
    const category = categories?.filter((c) => c.id === id);
    if (category?.length === 1) {
      return category[0].category;
    }
    return "Not found.";
  }

  function isRecent(input_datetime) {
    const now = new Date();
    input_datetime = new Date(input_datetime);
    const diffInMs = now.getTime() - input_datetime.getTime();
    const diffInHrs = diffInMs / (1000 * 60 * 60);
    return diffInHrs <= 5;
  }

  function getAccountCurrency(id) {
    const account = global.accounts?.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  return (
    <div className="expense-item" onClick={() => setTransactionPopup(expense)}>
      {isRecent(expense.created_on) && (
        <label className="new-transaction">NEW!</label>
      )}
      <label id="date">{expense.date}</label>
      <label id="description">{expense.description}</label>
      <label
        id="account"
        style={helper.accountLabelStyle(global.accounts, expense.account)}
      >
        {helper.getAccountName(global.accounts, expense.account)}
      </label>
      <label id="amount">
        {helper.showOrMask(
          global.privacyMode,
          helper.formatNumber(expense.amount)
        )}{" "}
        {helper.getCurrency(getAccountCurrency(expense.account))}
      </label>
      <label id="category">
        {getExpenseCategory(expense.expense_category)}
      </label>
    </div>
  );
};

const RecentIncomes = (props) => {
  if (props.incomes && props.incomes.length == 0) {
    return <NoRecentTransactionCard transaction_type={"incomes"} />;
  }
  return (
    <div className={"incomes"}>
      <div className={"header"}>
        <label className={"main-title"}>Recent Incomes:</label>
        <Link className={"more-link"} to="/dashboard/incomes">
          More Incomes
        </Link>
      </div>
      {props.incomes?.length > 0 &&
        props.incomes
          .slice(0, 5)
          .map((income) => (
            <IncomeItem
              key={income.id}
              income={income}
              accounts={props.accounts}
              categories={props.categories}
              setTransactionPopup={props.setTransactionPopup}
            />
          ))}
    </div>
  );
};

const IncomeItem = ({ income, accounts, categories, setTransactionPopup }) => {
  const global = useGlobalContext();

  function getIncomeCategory(id) {
    const category = categories?.filter((c) => c.id === id);
    if (category?.length === 1) {
      return category[0].category;
    }
    return "Not found.";
  }
  function isRecent(input_datetime) {
    const now = new Date();
    input_datetime = new Date(input_datetime);
    const diffInMs = now.getTime() - input_datetime.getTime();
    const diffInHrs = diffInMs / (1000 * 60 * 60);
    return diffInHrs <= 5;
  }

  function getAccountCurrency(id) {
    const account = global.accounts.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }
  return (
    <div className="income-item" onClick={() => setTransactionPopup(income)}>
      {isRecent(income.created_on) && (
        <label className="new-transaction">NEW!</label>
      )}
      <label id="date">{income.date}</label>
      <label id="description">{income.description}</label>
      <label
        id="account"
        style={helper.accountLabelStyle(global.accounts, income.account)}
      >
        {helper.getAccountName(global.accounts, income.account)}
      </label>
      <label id="amount">
        {helper.showOrMask(
          global.privacyMode,
          helper.formatNumber(income.amount)
        )}{" "}
        {helper.getCurrency(getAccountCurrency(income.account))}
      </label>
      <label id="category">{getIncomeCategory(income.income_category)}</label>
    </div>
  );
};

const RecentTransfers = ({ transfers, accounts, setTransactionPopup }) => {
  if (transfers && transfers.length == 0) {
    return <NoRecentTransactionCard transaction_type={"transfers"} />;
  }
  return (
    <div className={"transfers"}>
      <div className={"header"}>
        <label className={"main-title"}>Recent Transfers:</label>
        <Link className={"more-link"} to="/dashboard/transfers">
          More Transfers
        </Link>
      </div>
      {transfers?.length > 0 &&
        transfers
          .slice(0, 5)
          .map((transfer) => (
            <TransferItem
              key={transfer.id}
              transfer={transfer}
              accounts={accounts}
              setTransactionPopup={setTransactionPopup}
            />
          ))}
    </div>
  );
};

const TransferItem = ({ transfer, accounts, setTransactionPopup }) => {
  const global = useGlobalContext();

  function isRecent(input_datetime) {
    const now = new Date();
    input_datetime = new Date(input_datetime);
    const diffInMs = now.getTime() - input_datetime.getTime();
    const diffInHrs = diffInMs / (1000 * 60 * 60);
    return diffInHrs <= 5;
  }
  function getAccountCurrency(id) {
    const account = global.accounts?.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  return (
    <div
      className="transfer-item"
      onClick={() => setTransactionPopup(transfer)}
    >
      {isRecent(transfer.created_on) && (
        <label className="new-transaction">NEW!</label>
      )}
      <label id="date">{transfer.date}</label>
      <label id="description">{transfer.description}</label>
      <label
        id="from_account"
        style={helper.accountLabelStyle(global.accounts, transfer.from_account)}
      >
        {helper.getAccountName(global.accounts, transfer.from_account)}
      </label>
      <label
        id="to_account"
        style={helper.accountLabelStyle(global.accounts, transfer.to_account)}
      >
        {helper.getAccountName(global.accounts, transfer.to_account)}
      </label>
      <label id="amount">
        {helper.showOrMask(
          global.privacyMode,
          helper.formatNumber(transfer.amount)
        )}{" "}
        {helper.getCurrency(getAccountCurrency(transfer.from_account))}
      </label>
    </div>
  );
};

const NoRecentTransactionCard = ({ transaction_type }) => {
  return (
    <div className={"no_transactions"}>No recent {transaction_type} found.</div>
  );
};

export default Profile;
