import "./transaction_popup.scss";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import transactionService from "../../services/transactionService/transactionService";
import { helper } from "../helper";

const TransactionPopup = ({
  transaction,
  type,
  showPopup,
  refreshTransactions,
  getAccountCurrency,
  accounts,
  categories,
}) => {
  const showConfirm = useConfirm();
  const showToast = useToast();

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

  function getAccountName(id) {
    const account = accounts.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].name;
    }
    return "Not found";
  }

  function getCategory(id) {
    const category = categories?.filter((c) => c.id === id);
    if (category?.length === 1) {
      return category[0]?.category_type;
    }
    return "Not found.";
  }

  function getTitle() {
    if (getTransactionType() === "expense") {
      return `Spent ${transaction.amount} ${helper.getCurrency(
        getAccountCurrency(transaction.account)
      )} on ${getCategory(
        getCategoryType()
      ).toLowerCase()} from ${getAccountName(transaction.account)} account.`;
    }

    if (getTransactionType() === "income") {
      return `Earned ${transaction.amount} ${helper.getCurrency(
        getAccountCurrency(transaction.account)
      )} from ${getCategory(
        getCategoryType()
      ).toLowerCase()} to ${getAccountName(transaction.account)} account.`;
    }

    if (getTransactionType() === "transfer") {
      return `Transfered ${transaction.amount} ${helper.getCurrency(
        getAccountCurrency(transaction.from_account)
      )} from ${getAccountName(transaction.from_account)} to ${getAccountName(
        transaction.to_account
      )}.`;
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
    showPopup(() => false);
  }

  function handleDelete() {
    const typeStr = getTransactionType();
    showConfirm(`Delete ${getTransactionType()}?`, async () => {
      const payload = {
        type: type,
        id: transaction.id,
      };
      await transactionService.deleteExpense(payload);

      closePopup();
      refreshTransactions();
      showToast(`${typeStr[0].toUpperCase() + typeStr.substring(1)} deleted.`);
    });
  }

  return (
    <>
      <div className={"overlay"}></div>
      <div className={"popup-wrapper"}>
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
                  {parseFloat(transaction.amount).toFixed(2)}{" "}
                  {helper.getCurrency(
                    getAccountCurrency(transaction.from_account)
                  )}
                </span>
              </div>
              <div>
                <label>From Account: </label>
                <span> {getAccountName(transaction.from_account)}</span>
              </div>
              <div>
                <label>To Account: </label>
                <span> {getAccountName(transaction.to_account)}</span>
              </div>
            </>
          )}
          {getTransactionType() !== "transfer" && (
            <>
              <div>
                <label>Amount: </label>
                <span>
                  {parseFloat(transaction.amount).toFixed(2)}{" "}
                  {helper.getCurrency(getAccountCurrency(transaction.account))}
                </span>
              </div>
              <div>
                <label>Account: </label>
                <span> {getAccountName(transaction.account)}</span>
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
          <div>
            <label>Description: </label>
            <span> {transaction.description}</span>
          </div>
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
          </div>
        </div>
      </div>
      ;
    </>
  );
};

export default TransactionPopup;