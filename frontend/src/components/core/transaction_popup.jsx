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

  let type = -1;
  let categories = [];
  if ("income_category" in transaction) {
    type = 0;
    categories = global.incomeCategories;
  } else if ("expense_category" in transaction) {
    type = 1;
    categories = global.expenseCategories;
  } else if ("from_account" in transaction) {
    type = 2;
  }

  function getTransactionType() {
    switch (type) {
      case 0:
        return "income";
      case 1:
        return "expense";
      case 2:
        return "transfer";
      default:
        return "";
    }
  }

  function getCategory(id) {
    const category = categories?.filter((c) => c.id === id);
    if (category?.length === 1) {
      return category[0]?.category;
    }
    return "Not found.";
  }

  function getTitle() {
    if (getTransactionType() === "expense") {
      return `Spent ${helper.showOrMask(
        global.privacyMode,
        transaction.amount
      )} ${helper.getCurrency(
        getAccountCurrency(transaction.account)
      )} on ${getCategory(
        getCategoryType()
      ).toLowerCase()} from ${helper.getAccountName(
        global.accounts,
        transaction.account
      )} account.`;
    }

    if (getTransactionType() === "income") {
      return `Earned ${helper.showOrMask(
        global.privacyMode,
        transaction.amount
      )} ${helper.getCurrency(
        getAccountCurrency(transaction.account)
      )} from ${getCategory(
        getCategoryType()
      ).toLowerCase()} to ${helper.getAccountName(
        global.accounts,
        transaction.account
      )} account.`;
    }

    if (getTransactionType() === "transfer") {
      return `Transfered ${helper.showOrMask(
        global.privacyMode,
        transaction.amount
      )} ${helper.getCurrency(
        getAccountCurrency(transaction.from_account)
      )} from ${helper.getAccountName(
        global.accounts,
        transaction.from_account
      )} to ${helper.getAccountName(global.accounts, transaction.to_account)}.`;
    }
  }

  function getCategoryType() {
    switch (getTransactionType()) {
      case "expense":
        return transaction.expense_category;
      case "income":
        return transaction.income_category;
      default:
        return "";
    }
  }

  function closePopup() {
    showPopup(false);
  }

  function handleDelete() {
    const typeStr = getTransactionType();
    showConfirm(`Delete ${getTransactionType()}?`, async () => {
      const payload = {
        type: type,
        id: transaction.id,
      };
      if (typeStr === "expense") {
        await transactionService.deleteExpense(payload);
      } else if (typeStr === "income") {
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
      showToast(`${typeStr[0].toUpperCase() + typeStr.substring(1)} deleted.`);
    });
  }

  async function addTransaction(type, payload) {
    switch (type) {
      case "income":
        await transactionService.addIncome(payload);
        showToast("Income Added.");
        break;
      case "expense":
        await transactionService.addIncome(payload);
        showToast("Income Added.");
        break;
      default:
        showToast("Wrong transaction type.");
        break;
    }
  }

  function handleRepeatTransaction() {
    showConfirm("Repeat transaction?", async () => {
      const category_key = type === 0 ? "income_category" : "expense_category";
      const category_value =
        type === 0 ? transaction.income_category : transaction.expense_category;

      const payload = {
        type: type,
        amount: transaction.amount,
        account: transaction.account,
        description: transaction.description,
        [category_key]: category_value,
        tags: transaction.tags.map((tag) => ({ name: tag.name })),
        date: new Date().toISOString().slice(0, 10),
      };

      await addTransaction(getTransactionType(), payload);
      await refreshTransactions();

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
              {type == 1 && "Paid on"}
              {type == 0 && "Earned on"}
              {type == 2 && "Transfered on"} {transaction.date}
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
          {getTransactionType() === "transfer" && (
            <>
              <div>
                <label>Amount: </label>
                <span>
                  {helper.showOrMask(
                    global.privacyMode,
                    parseFloat(transaction.amount).toFixed(2)
                  )}{" "}
                  {helper.getCurrency(
                    getAccountCurrency(transaction.from_account)
                  )}
                </span>
              </div>
              <div>
                <label>From Account: </label>
                <span
                  style={helper.accountLabelStyle(
                    global.accounts,
                    transaction.from_account
                  )}
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
                <span>
                  {" "}
                  {helper.getAccountName(
                    global.accounts,
                    transaction.to_account
                  )}
                </span>
              </div>
            </>
          )}
          {getTransactionType() !== "transfer" && (
            <>
              <div>
                <label>Amount: </label>
                <span>
                  {helper.showOrMask(
                    global.privacyMode,
                    parseFloat(transaction.amount).toFixed(2)
                  )}{" "}
                  {helper.getCurrency(getAccountCurrency(transaction.account))}
                </span>
              </div>
              <div>
                <label>Account: </label>
                <span
                  style={helper.accountLabelStyle(
                    global.accounts,
                    transaction.account
                  )}
                >
                  {" "}
                  {helper.getAccountName(global.accounts, transaction.account)}
                </span>
              </div>
              <div>
                <label>Category: </label>
                <span> {getCategory(getCategoryType())}</span>
              </div>
            </>
          )}
          <div>
            <label>User: </label>
            <span> {transaction.user}</span>
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
              Delete {getTransactionType()}
            </button>
            <button
              id="editButton"
              onClick={() => showToast("Not implemented yet.")}
            >
              Edit
            </button>
            {(type === 0 || type === 1) && (
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
      ;
    </>
  );
};

export default TransactionPopup;
