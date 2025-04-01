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
      const payload = {
        type: transactionType == "income" ? 0 : 1,
        amount: props.transaction.amount,
        account: props.transaction.account,
        description: props.transaction.description,
        category: props.transaction.category,
        tags: props.transaction.tags.map((tag) => ({ name: tag.name })),
        date: new Date().toISOString().slice(0, 10),
      };

      await addTransaction(payload);
      await props.refreshTransactions();
    });
  }

  function handleDelete() {
    showConfirm(`Delete ${transactionType}?`, async () => {
      const payload = {
        type: transactionType == "income" ? 0 : 1,
        id: props.transaction.id,
      };
      if (transactionType === "expense") {
        await transactionService.deleteExpense(payload);
      } else if (transactionType === "income") {
        await transactionService.deleteIncome(payload);
      } else {
        await transactionService.deleteTransfer(payload);
      }

      await props.refreshTransactions();
      showToast(
        `${
          transactionType[0].toUpperCase() + transactionType.substring(1)
        } deleted.`
      );
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
          {(transactionType === "income" || transactionType === "expense") && (
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
