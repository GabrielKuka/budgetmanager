import React, { useState, useRef, useEffect } from "react";
import { useGlobalContext } from "../../context/GlobalContext";
import transactionService from "../../services/transactionService/transactionService";
import "./transactionItem.scss";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { helper } from "../helper";

const TransactionItem = (props) => {
  const global = useGlobalContext();
  const [showKebab, setShowKebab] = useState(false);
  const showConfirm = useConfirm();
  const showToast = useToast();
  const kebabMenu = useRef(null);
  const transactionType = props.transaction?.transaction_type;

  let itemType = -1;
  let categories = [];
  if (transactionType === "income") {
    categories = global.incomeCategories;
  } else if (transactionType === "expense") {
    categories = global.expenseCategories;
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      const kebabClicked = !!(
        event.target?.attributes?.class?.value?.includes("kebab-button") ||
        event.target?.attributes?.src?.value?.includes("kebab_icon")
      );

      if (!kebabMenu?.current?.contains(event.target) && !kebabClicked) {
        setShowKebab(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function getTransactionType() {
    switch (itemType) {
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
  function toggleKebab() {
    setShowKebab((prevState) => !prevState);
  }

  function handleShowMore(event) {
    const kebabClicked = !!(
      event.target?.attributes?.class?.value?.includes("kebab-button") ||
      event.target?.attributes?.src?.value?.includes("kebab_icon")
    );
    const deleteButtonClicked =
      !!event.target?.attributes?.id?.value?.includes("deleteButton");

    const repeatTransactionButtonClicked =
      !!event.target?.attributes?.id?.value?.includes(
        "repeatTransactionButton"
      );

    if (
      !kebabClicked &&
      !deleteButtonClicked &&
      !repeatTransactionButtonClicked
    ) {
      props.setTransactionPopup(props.transaction);
    }
  }

  async function addTransaction(payload) {
    switch (itemType) {
      case 0:
        await transactionService.addIncome(payload);
        showToast("Income Added.");
        break;
      case 1:
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
      const category_key =
        itemType === 0 ? "income_category" : "expense_category";

      if (![0, 1].includes(itemType)) {
        return;
      }

      const category_value =
        itemType === 0
          ? props.transaction.income_category
          : props.transaction.expense_category;

      const payload = {
        type: itemType,
        amount: props.transaction.amount,
        account: props.transaction.account,
        description: props.transaction.description,
        [category_key]: category_value,
        tags: props.transaction.tags.map((tag) => ({ name: tag.name })),
        date: new Date().toISOString().slice(0, 10),
      };

      await addTransaction(payload);
      await props.refreshTransactions();
    });
  }

  function handleDelete() {
    const typeStr = getTransactionType();
    showConfirm(`Delete ${getTransactionType()}?`, async () => {
      const payload = {
        type: itemType,
        id: props.transaction.id,
      };
      if (typeStr === "expense") {
        await transactionService.deleteExpense(payload);
      } else if (typeStr === "income") {
        await transactionService.deleteIncome(payload);
      } else {
        await transactionService.deleteTransfer(payload);
      }

      await props.refreshTransactions();
      showToast(`${typeStr[0].toUpperCase() + typeStr.substring(1)} deleted.`);
    });
  }

  function getCategory(id) {
    const result = categories?.filter((c) => c.id === id);
    if (result?.length === 1) {
      return result[0]?.category;
    }
    return "Not found.";
  }

  return (
    <div className="transaction-item" onClick={handleShowMore}>
      {helper.isRecent(props.transaction.created_on) && (
        <label className="new-transaction">NEW!</label>
      )}
      <label id="date">{props.transaction.date}</label>
      <label id="description">{props.transaction.description}</label>
      {(transactionType === "income" || transactionType === "expense") && (
        <label
          id="account"
          style={helper.accountLabelStyle(
            global.accounts,
            transactionType === "income"
              ? props.transaction.to_account
              : props.transaction.from_account
          )}
        >
          {helper.getAccountName(
            global.accounts,
            transactionType === "income"
              ? props.transaction.to_account
              : props.transaction.from_account
          )}
        </label>
      )}
      {transactionType === "transfer" && (
        <>
          <label
            id="from_account"
            style={helper.accountLabelStyle(
              global.accounts,
              props.transaction.from_account
            )}
          >
            {helper.getAccountName(
              global.accounts,
              props.transaction.from_account
            )}
          </label>
          <label
            id="to_account"
            style={helper.accountLabelStyle(
              global.accounts,
              props.transaction.to_account
            )}
          >
            {helper.getAccountName(
              global.accounts,
              props.transaction.to_account
            )}
          </label>
        </>
      )}
      <label
        id="amount"
        style={{ color: helper.amountLabelColor(transactionType) }}
      >
        {transactionType === "income" && <span>+ </span>}
        {transactionType === "expense" && <span>- </span>}
        {helper.showOrMask(
          global.privacyMode,
          helper.formatNumber(props.transaction?.amount)
        )}{" "}
        {props.currency}
      </label>
      {(transactionType === "income" || transactionType === "expense") && (
        <label id="category">
          <span>{helper.categoryIcon(props.transaction.category)}</span>
          {getCategory(props.transaction.category)}
        </label>
      )}
      <button className={"kebab-button"} onClick={toggleKebab}>
        <img
          src={`${process.env.PUBLIC_URL}/kebab_icon.png`}
          alt="kebap-icon"
        />
      </button>
      {showKebab && (
        <div
          ref={kebabMenu}
          className={"kebab-menu"}
          id={`kebab-menu-${props.transaction.id}`}
        >
          <button onClick={handleDelete} id="deleteButton">
            Delete
          </button>
          <button onClick={handleShowMore} id="showMoreButton">
            Show more
          </button>
          {(itemType === 0 || itemType === 1) && (
            <button
              onClick={handleRepeatTransaction}
              id="repeatTransactionButton"
            >
              Repeat Transaction
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TransactionItem;
