import { useNavigate } from "react-router-dom";
import { useConfirm } from "../../context/ConfirmContext";
import { useGlobalContext } from "../../context/GlobalContext";
import { useToast } from "../../context/ToastContext";
import transactionService from "../../services/transactionService/transactionService";
import { helper } from "../helper";
import "./transaction_popup.scss";

const TransactionPopup = ({
  transaction,
  showPopup,
  getAccountCurrency,
  refreshTransactions,
  refreshSearchResults,
}) => {
  const global = useGlobalContext();
  const showConfirm = useConfirm();
  const showToast = useToast();
  const navigate = useNavigate();
  const transactionType = transaction.transaction_type;

  let categories = [];
  if (transactionType === "income") {
    categories = global.incomeCategories;
  } else if (transactionType === "expense") {
    categories = global.expenseCategories;
  }

  function getCategory(id) {
    if (id == null) {
      return "Uncategorized";
    }
    const category = categories?.filter((c) => c.id === id);
    if (category?.length === 1) {
      return category[0]?.category;
    }
    return "Uncategorized";
  }

  function getCategoryPhrase(id) {
    const category = getCategory(id);
    if (category === "Uncategorized") {
      return "without category";
    }
    return `from ${category.toLowerCase()}`;
  }

  function getTransactionCurrency() {
    return helper.getTransactionCurrency(
      global.accounts,
      transaction,
      getAccountCurrency
    );
  }

  function getTitle() {
    if (transactionType === "expense") {
      return `Spent ${helper.showOrMask(
        global.privacyMode,
        helper.formatNumber(transaction.amount)
      )} ${helper.getCurrency(getTransactionCurrency())} ${getCategoryPhrase(
        transaction.category
      )} from ${helper.getAccountName(
        global.accounts,
        transaction.from_account
      )} account.`;
    }

    if (transactionType === "income") {
      return `Earned ${helper.showOrMask(
        global.privacyMode,
        helper.formatNumber(transaction.amount)
      )} ${helper.getCurrency(getTransactionCurrency())} ${getCategoryPhrase(
        transaction.category
      )} to ${helper.getAccountName(
        global.accounts,
        transaction.to_account
      )} account.`;
    }

    if (transactionType === "transfer") {
      return `Transfered ${helper.showOrMask(
        global.privacyMode,
        helper.formatNumber(transaction.amount)
      )} ${helper.getCurrency(
        getTransactionCurrency()
      )} from ${helper.getAccountName(
        global.accounts,
        transaction.from_account
      )} to ${helper.getAccountName(global.accounts, transaction.to_account)}.`;
    }

    if (transactionType === "buy") {
      return `Bought ${helper.showOrMask(
        global.privacyMode,
        helper.formatNumber(transaction.quantity, 4)
      )} units at ${helper.showOrMask(
        global.privacyMode,
        helper.formatNumber(transaction.price_per_unit)
      )}.`;
    }

    if (transactionType === "sell") {
      return `Sold ${helper.showOrMask(
        global.privacyMode,
        helper.formatNumber(transaction.quantity, 4)
      )} units at ${helper.showOrMask(
        global.privacyMode,
        helper.formatNumber(transaction.price_per_unit)
      )}.`;
    }

    return "";
  }

  function closePopup() {
    showPopup(false);
  }

  function handleDelete() {
    showConfirm(`Delete ${transactionType}?`, async () => {
      const payload = {
        type: transactionType,
        id: transaction.id,
      };
      if (transactionType === "expense") {
        await transactionService.deleteExpense(payload);
      } else if (transactionType === "income") {
        await transactionService.deleteIncome(payload);
      } else {
        await transactionService.deleteTransfer(payload);
      }

      // Remove from search results if it exists
      if (refreshSearchResults !== null && refreshSearchResults !== undefined) {
        refreshSearchResults(transaction.id);
      }

      closePopup();
      await refreshTransactions();
      showToast(
        `${
          transactionType[0].toUpperCase() + transactionType.substring(1)
        } deleted.`
      );
    });
  }

  async function addTransaction(payload) {
    switch (transactionType) {
      case "income":
        await transactionService.addIncome(payload);
        showToast("Income Added.");
        break;
      case "expense":
        await transactionService.addExpense(payload);
        showToast("Expense Added.");
        break;
      default:
        showToast("Wrong transaction type.");
        break;
    }
  }

  function handleRepeatTransaction() {
    showConfirm("Repeat transaction?", async () => {
      let t_type = null;
      if (transactionType === "income") {
        t_type = 0;
      }
      if (transactionType === "expense") {
        t_type = 1;
      }
      if (transactionType === "transfer") {
        t_type = 2;
      }
      const payload = {
        type: t_type,
        amount: transaction.amount,
        description: transaction.description,
        category: transaction.category,
        tags: (transaction.tags || []).map((tag) => ({ name: tag.name })),
        date: new Date().toISOString().slice(0, 10),
      };

      if (t_type === 0) {
        if (transaction.to_cash_balance) {
          payload.to_cash_balance = transaction.to_cash_balance;
        } else {
          payload.to_account = transaction.to_account;
        }
      } else if (t_type === 1) {
        if (transaction.from_cash_balance) {
          payload.from_cash_balance = transaction.from_cash_balance;
        } else {
          payload.from_account = transaction.from_account;
        }
      }

      await addTransaction(payload);
      await refreshTransactions();
      await global.updateAccounts();

      closePopup();
    });
  }

  return (
    <>
      <div className={"overlay"}></div>
      <div className={"transaction-popup-wrapper"}>
        <div className={"title-bar"}>
          <div className={"main"}>
            <span className={"title"}>{getTitle()}</span>
            <span className={"date"}>
              {transactionType == "expense" && "Paid on"}
              {transactionType == "income" && "Earned on"}
              {transactionType == "transfer" && "Transfered on"}{" "}
              {transactionType == "buy" && "Bought on"}{" "}
              {transactionType == "sell" && "Sold on"} {transaction.date}
            </span>
          </div>
          <button className={"close-popup"} onClick={closePopup}>
            X
          </button>
        </div>
        <div className={"content"}>
          <div>
            <label>ID: </label>
            <span> {transaction.id}</span>
          </div>
          {transactionType === "transfer" && (
            <>
              <div>
                <label>Amount: </label>
                <span>
                  {helper.showOrMask(
                    global.privacyMode,
                    helper.formatNumber(transaction.amount)
                  )}{" "}
                  {helper.getCurrency(getTransactionCurrency())}
                </span>
              </div>
              <div>
                <label>From Account: </label>
                <span
                  className={"account_name"}
                  style={helper.accountLabelStyle(
                    global.accounts,
                    transaction.from_account
                  )}
                  onClick={() =>
                    navigate(`/accounts/${transaction.from_account}`)
                  }
                >
                  {" "}
                  {helper.getAccountName(
                    global.accounts,
                    transaction.from_account
                  )}
                </span>
              </div>
              <div>
                <label>To Account: </label>
                <span
                  className="account_name"
                  onClick={() =>
                    navigate(`/accounts/${transaction.to_account}`)
                  }
                >
                  {" "}
                  {helper.getAccountName(
                    global.accounts,
                    transaction.to_account
                  )}
                </span>
              </div>
            </>
          )}
          {transactionType !== "transfer" && (
            <>
              <div>
                <label>Amount: </label>
                <span>
                  {helper.showOrMask(
                    global.privacyMode,
                    helper.formatNumber(transaction.amount)
                  )}{" "}
                  {helper.getCurrency(getTransactionCurrency())}
                </span>
              </div>
              <div>
                <label>Account: </label>
                <span
                  className="account_name"
                  onClick={() =>
                    navigate(
                      `/accounts/${
                        transactionType === "income"
                          ? transaction.to_account
                          : transactionType === "sell"
                          ? transaction.to_account
                          : transaction.from_account
                      }`
                    )
                  }
                  style={helper.accountLabelStyle(
                    global.accounts,
                    transaction.account
                  )}
                >
                  {" "}
                  {helper.getAccountName(
                    global.accounts,
                    transactionType === "income"
                      ? transaction.to_account
                      : transactionType === "sell"
                      ? transaction.to_account
                      : transaction.from_account
                  )}
                </span>
              </div>
              {(transactionType === "income" ||
                transactionType === "expense") && (
                <div>
                  <label>Category: </label>
                  <span>{helper.categoryIcon(transaction.category)}</span>
                  <span> {getCategory(transaction.category)}</span>
                </div>
              )}
            </>
          )}
          {(transactionType === "buy" || transactionType === "sell") && (
            <>
              <div>
                <label>Security ID: </label>
                <span> {transaction.security}</span>
              </div>
              <div>
                <label>Quantity: </label>
                <span> {helper.formatNumber(transaction.quantity, 4)}</span>
              </div>
              <div>
                <label>Price per unit: </label>
                <span>
                  {helper.formatNumber(transaction.price_per_unit)}{" "}
                  {helper.getCurrency(
                    getAccountCurrency(
                      transactionType === "buy"
                        ? transaction.from_account
                        : transaction.to_account
                    )
                  )}
                </span>
              </div>
              {transaction.holding && (
                <div>
                  <label>Holding ID: </label>
                  <span> {transaction.holding}</span>
                </div>
              )}
            </>
          )}
          <div>
            <label>User: </label>
            <span> {global.user.data.name}</span>
          </div>
          {transaction?.description && (
            <div>
              <label>Description: </label>
              <span> {transaction.description}</span>
            </div>
          )}
          <div>
            <label>Created on: </label>
            <span> {new Date(transaction.created_on).toLocaleString()} </span>
            <img
              src={`${process.env.PUBLIC_URL}/questionmark_icon.png`}
              width="17"
              height="17"
              className={"questionmark"}
              onMouseOver={() => {
                document.getElementById("tooltip").style.visibility = "visible";
              }}
              onMouseOut={() => {
                document.getElementById("tooltip").style.visibility = "hidden";
              }}
            />
            <span className={"questionmark_tooltip"} id="tooltip">
              The date and time when the transaction was added in the system.
            </span>
          </div>
          {transaction?.tags?.length > 0 && (
            <div>
              <label>Tags: </label>
              {transaction.tags.map((t) => (
                <span key={t.id} className={"tag"}>
                  {t.name}
                </span>
              ))}
            </div>
          )}
          <div className={"options"}>
            <button onClick={handleDelete} id="deleteButton">
              Delete {transactionType}
            </button>
            <button
              id="editButton"
              onClick={() => showToast("Not implemented yet.")}
            >
              Edit
            </button>
            {(transactionType === "income" ||
              transactionType === "expense") && (
              <button
                id="repeatTransactionButton"
                onClick={handleRepeatTransaction}
              >
                Repeat Transaction
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default TransactionPopup;
