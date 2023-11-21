import { useState, useEffect } from "react";
import "./transaction_popup.scss";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import transactionService from "../../services/transactionService/transactionService";

const TransactionPopup = ({ transaction, type, showPopup }) => {
  const showConfirm = useConfirm();
  const showToast = useToast();

  function getCategoryType() {
    switch (type) {
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
    showConfirm(`Delete ${type}?`, async () => {
      let transactionType = null;
      switch (type) {
        case "income":
          transactionType = 0;
          break;
        case "expense":
          transactionType = 1;
          break;
        default:
          transactionType = 2;
      }

      const payload = {
        type: transactionType,
        id: transaction.id,
      };
      //await transactionService.deleteExpense(payload);

      showToast(`${type[0].toUpperCase() + type[1].substring(1)} deleted.`);
      //refreshExpenses();
    });
  }

  return (
    <>
      <div className={"overlay"}></div>
      <div className={"popup-wrapper"}>
        <div className={"title-bar"}>
          <div className={"main"}>
            <span className={"description"}>{transaction.description}</span>
            <span className={"date"}>
              {type == "expense" && "Paid on"}
              {type == "income" && "Earned on"}
              {type == "transfer" && "Transfered on"} {transaction.date}
            </span>
          </div>
          <button className={"close-popup"} onClick={closePopup}>
            X
          </button>
        </div>
        <div className={"content"}>
          Amount: {transaction.amount}
          <br />
          Account: {transaction.account}
          <br />
          Id: {transaction.id}
          <br />
          Created on: {transaction.created_on}
          <br />
          Category: {getCategoryType()}
          <br />
          User: {transaction.user}
          <br />
          <button>Edit</button>
          <br />
          <button>Delete {type}</button>
        </div>
      </div>
      ;
    </>
  );
};

export default TransactionPopup;
