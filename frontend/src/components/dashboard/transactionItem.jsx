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

    const pinToggleButtonClicked =
      !!event.target?.attributes?.id?.value?.includes("pinToggleButton");

    if (
      !kebabClicked &&
      !deleteButtonClicked &&
      !repeatTransactionButtonClicked &&
      !pinToggleButtonClicked
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
        type: transactionType === "income" ? 0 : 1,
        amount: props.transaction.amount,
        description: props.transaction.description,
        category: props.transaction.category,
        tags: (props.transaction.tags || []).map((tag) => ({
          name: tag.name,
        })),
        date: new Date().toISOString().slice(0, 10),
      };

      if (transactionType === "income") {
        if (props.transaction.to_cash_balance) {
          payload.to_cash_balance = props.transaction.to_cash_balance;
        } else {
          payload.to_account = props.transaction.to_account;
        }
      } else if (transactionType === "expense") {
        if (props.transaction.from_cash_balance) {
          payload.from_cash_balance = props.transaction.from_cash_balance;
        } else {
          payload.from_account = props.transaction.from_account;
        }
      }

      await addTransaction(payload);
      await props.refreshTransactions();
      await props.refreshAccounts();
    });
  }

  function handlePinToggle() {
    global.toggleTransactionPin(props.transaction.id);
    setShowKebab(false);
  }

  async function handleApplyDraft() {
    showConfirm("Apply this draft? Balances will be updated.", async () => {
      await transactionService.applyDraft(props.transaction.id);
      await props.refreshTransactions();
      showToast("Draft applied.");
    });
    setShowKebab(false);
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
    if (id == null) {
      return "Uncategorized";
    }
    const result = categories?.filter((c) => c.id === id);
    if (result?.length === 1) {
      return result[0]?.category;
    }
    return "Uncategorized";
  }

  return (
    <div
      className={`transaction-item${props.transaction.pinned ? " pinned" : ""}`}
      onClick={handleShowMore}
    >
      {helper.isRecent(props.transaction.created_on) && (
        <label className="new-transaction">NEW!</label>
      )}
      {props.transaction.is_draft && (
        <label className="draft-badge">
          DRAFT
          {props.transaction.scheduled_apply_at && (
            <span className="draft-schedule">
              &middot;{" "}
              {new Date(
                props.transaction.scheduled_apply_at
              ).toLocaleDateString()}
            </span>
          )}
        </label>
      )}
      <label id="date" data-label="Date">
        <span className="transaction-value">{props.transaction.date}</span>
      </label>
      <label id="description" data-label="Description">
        <span className="transaction-value">
          {props.transaction.description}
        </span>
      </label>
      {(transactionType === "income" || transactionType === "expense") && (
        <label
          id="account"
          data-label="Account"
          style={helper.accountLabelStyle(
            global.accounts,
            transactionType === "income"
              ? props.transaction.to_account
              : props.transaction.from_account
          )}
        >
          <span className="transaction-value">
            {helper.getAccountName(
              global.accounts,
              transactionType === "income"
                ? props.transaction.to_account
                : props.transaction.from_account
            )}
          </span>
        </label>
      )}
      {(transactionType === "buy" || transactionType === "sell") && (
        <label
          id="account"
          data-label="Account"
          style={helper.accountLabelStyle(
            global.accounts,
            transactionType === "buy"
              ? props.transaction.from_account
              : props.transaction.to_account
          )}
        >
          <span className="transaction-value">
            {helper.getAccountName(
              global.accounts,
              transactionType === "buy"
                ? props.transaction.from_account
                : props.transaction.to_account
            )}
          </span>
        </label>
      )}
      {transactionType === "transfer" && (
        <>
          <label
            id="from_account"
            data-label="From"
            style={helper.accountLabelStyle(
              global.accounts,
              props.transaction.from_account
            )}
          >
            <span className="transaction-value">
              {helper.getAccountName(
                global.accounts,
                props.transaction.from_account
              )}
            </span>
          </label>
          <label
            id="to_account"
            data-label="To"
            style={helper.accountLabelStyle(
              global.accounts,
              props.transaction.to_account
            )}
          >
            <span className="transaction-value">
              {helper.getAccountName(
                global.accounts,
                props.transaction.to_account
              )}
            </span>
          </label>
        </>
      )}
      <label
        id="amount"
        data-label="Amount"
        style={{ color: helper.amountLabelColor(transactionType) }}
      >
        <span className="transaction-value amount-value">
          {transactionType === "income" && <span>+ </span>}
          {transactionType === "expense" && <span>- </span>}
          {helper.showOrMask(
            global.privacyMode,
            helper.formatNumber(props.transaction?.amount)
          )}{" "}
          {props.currency}
        </span>
      </label>
      {(transactionType === "income" || transactionType === "expense") && (
        <label id="category" data-label="Category">
          <span className="transaction-value category-value">
            <span className="category-icon">
              {helper.categoryIcon(props.transaction.category)}
            </span>
            <span>{getCategory(props.transaction.category)}</span>
          </span>
        </label>
      )}
      {(transactionType === "buy" || transactionType === "sell") && (
        <label id="type" data-label="Type">
          <span
            className="transaction-value type-value"
            style={{
              color: transactionType === "buy" ? "seagreen" : "red",
              fontWeight: "bold",
            }}
          >
            {transactionType === "buy" ? "BUY" : "SELL"}
          </span>
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
          <button onClick={handlePinToggle} id="pinToggleButton">
            {props.transaction.pinned ? "Unpin" : "Pin"}
          </button>
          <button onClick={handleDelete} id="deleteButton">
            Delete
          </button>
          <button onClick={handleShowMore} id="showMoreButton">
            Show more
          </button>
          {props.transaction.is_draft && (
            <button onClick={handleApplyDraft} id="applyDraftButton">
              Apply Draft
            </button>
          )}
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
