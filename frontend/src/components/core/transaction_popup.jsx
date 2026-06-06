import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useConfirm } from "../../context/ConfirmContext";
import { useGlobalContext } from "../../context/GlobalContext";
import { useToast } from "../../context/ToastContext";
import transactionService from "../../services/transactionService/transactionService";
import { helper } from "../helper";
import "./transaction_popup.scss";

// ── Type-specific meta ──
const TYPE_META = {
  expense: { icon: "💸", verb: "Spent", dateLabel: "Paid on", color: "#c92a2a" },
  income: { icon: "💰", verb: "Earned", dateLabel: "Earned on", color: "#2f9e44" },
  transfer: { icon: "🔄", verb: "Transferred", dateLabel: "Transferred on", color: "var(--brand)" },
  buy: { icon: "📈", verb: "Bought", dateLabel: "Bought on", color: "#ff8c00" },
  sell: { icon: "📉", verb: "Sold", dateLabel: "Sold on", color: "#2e8b57" },
};

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
  const [isPinned, setIsPinned] = useState(transaction.pinned);
  const typeMeta = TYPE_META[transactionType] || {};

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        closePopup();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  function getTransactionCurrency() {
    return helper.getTransactionCurrency(
      global.accounts,
      transaction,
      getAccountCurrency
    );
  }

  function getAccountId() {
    if (transactionType === "income" || transactionType === "sell") {
      return transaction.to_account;
    }
    return transaction.from_account;
  }

  function closePopup() {
    showPopup(false);
  }

  function handlePinToggle() {
    setIsPinned((prev) => !prev);
    global.toggleTransactionPin(transaction.id);
  }

  function handleDelete() {
    showConfirm(`Delete ${transactionType}?`, async () => {
      const payload = { type: transactionType, id: transaction.id };
      if (transactionType === "expense") {
        await transactionService.deleteExpense(payload);
      } else if (transactionType === "income") {
        await transactionService.deleteIncome(payload);
      } else {
        await transactionService.deleteTransfer(payload);
      }

      if (refreshSearchResults != null) {
        refreshSearchResults(transaction.id);
      }

      closePopup();
      await refreshTransactions();
      showToast(
        `${transactionType[0].toUpperCase() + transactionType.substring(1)} deleted.`
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
      if (transactionType === "income") t_type = 0;
      if (transactionType === "expense") t_type = 1;
      if (transactionType === "transfer") t_type = 2;

      const payload = {
        type: t_type,
        amount: transaction.amount,
        description: transaction.description,
        category: transaction.category,
        tags: (transaction.tags || []).map((tag) => ({ name: tag.name })),
        date: new Date().toISOString().slice(0, 10),
      };

      if (t_type === 0) {
        payload.to_cash_balance = transaction.to_cash_balance || null;
        payload.to_account = transaction.to_account;
      } else if (t_type === 1) {
        payload.from_cash_balance = transaction.from_cash_balance || null;
        payload.from_account = transaction.from_account;
      }

      await addTransaction(payload);
      await refreshTransactions();
      await global.updateAccounts();
      closePopup();
    });
  }

  // ── Derived display values ──
  const currency = getTransactionCurrency();
  const amountDisplay = helper.showOrMask(
    global.privacyMode,
    helper.formatNumber(transaction.amount)
  );
  const amountColor = helper.amountLabelColor(transactionType);
  const accountId = getAccountId();
  const accountName = helper.getAccountName(global.accounts, accountId);
  const categoryName = getCategory(transaction.category);
  const categoryEmoji = helper.categoryIcon(transaction.category);
  const quantDisplay = helper.showOrMask(
    global.privacyMode,
    helper.formatNumber(transaction.quantity, 4)
  );
  const priceDisplay = helper.showOrMask(
    global.privacyMode,
    helper.formatNumber(transaction.price_per_unit)
  );

  const isSecurity = transactionType === "buy" || transactionType === "sell";
  const canRepeat =
    transactionType === "income" || transactionType === "expense";

  return (
    <>
      <div className="overlay" onClick={closePopup}></div>
      <div className="transaction-popup-wrapper">
        {/* ── Title bar ── */}
        <div className="title-bar">
          <div className="main">
            <span className="type-icon">{typeMeta.icon}</span>
            <div className="title-area">
              <span className="title">
                {typeMeta.verb} {amountDisplay} {helper.getCurrency(currency)}
              </span>
              <span className="date">
                {typeMeta.dateLabel} {transaction.date}
              </span>
            </div>
            <button
              className={`pin-badge${isPinned ? " pinned" : ""}`}
              onClick={handlePinToggle}
              title={isPinned ? "Unpin transaction" : "Pin transaction"}
            >
              {isPinned ? "📌 Pinned" : "📌 Pin"}
            </button>
          </div>
          <button className="close-popup" onClick={closePopup}>
            ✕
          </button>
        </div>

        {/* ── Content ── */}
        <div className="content">
          {/* ── Section: Overview ── */}
          <div className="section">
            <div className="section-heading">Overview</div>
            <div className="field-grid">
              {/* Amount — full width, highlighted */}
              <div className="field-row full-width amount-field">
                <span className="field-label">Amount</span>
                <span className="field-value" style={{ color: amountColor }}>
                  {amountDisplay} {helper.getCurrency(currency)}
                </span>
              </div>

              {/* Account */}
              <div className="field-row">
                <span className="field-label">
                  {isSecurity || transactionType === "transfer"
                    ? "From Account"
                    : "Account"}
                </span>
                <span
                  className="field-value account_name"
                  style={helper.accountLabelStyle(global.accounts, accountId)}
                  onClick={() => navigate(`/accounts/${accountId}`)}
                >
                  {accountName}
                </span>
              </div>

              {/* To Account (transfer only) */}
              {transactionType === "transfer" && (
                <div className="field-row">
                  <span className="field-label">To Account</span>
                  <span
                    className="field-value account_name"
                    onClick={() =>
                      navigate(`/accounts/${transaction.to_account}`)
                    }
                  >
                    {helper.getAccountName(
                      global.accounts,
                      transaction.to_account
                    )}
                  </span>
                </div>
              )}

              {/* To Account (sell only) */}
              {transactionType === "sell" && (
                <div className="field-row">
                  <span className="field-label">To Account</span>
                  <span
                    className="field-value account_name"
                    onClick={() =>
                      navigate(`/accounts/${transaction.to_account}`)
                    }
                  >
                    {helper.getAccountName(
                      global.accounts,
                      transaction.to_account
                    )}
                  </span>
                </div>
              )}

              {/* Category */}
              {(transactionType === "income" ||
                transactionType === "expense") && (
                <div className="field-row">
                  <span className="field-label">Category</span>
                  <span className="field-value">
                    {categoryEmoji} {categoryName}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Section: Security Details (buy/sell only) ── */}
          {isSecurity && (
            <div className="section">
              <div className="section-heading">Security Details</div>
              <div className="field-grid">
                <div className="field-row">
                  <span className="field-label">Security ID</span>
                  <span className="field-value">{transaction.security}</span>
                </div>
                <div className="field-row">
                  <span className="field-label">Quantity</span>
                  <span className="field-value">{quantDisplay}</span>
                </div>
                <div className="field-row">
                  <span className="field-label">Price / Unit</span>
                  <span className="field-value">
                    {priceDisplay}{" "}
                    {helper.getCurrency(
                      getAccountCurrency(accountId)
                    )}
                  </span>
                </div>
                {transaction.holding && (
                  <div className="field-row">
                    <span className="field-label">Holding ID</span>
                    <span className="field-value">{transaction.holding}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Section: Metadata ── */}
          <div className="section">
            <div className="section-heading">Metadata</div>
            <div className="field-grid">
              <div className="field-row">
                <span className="field-label">ID</span>
                <span className="field-value">#{transaction.id}</span>
              </div>
              <div className="field-row">
                <span className="field-label">User</span>
                <span className="field-value">
                  {global.user.data.name}
                </span>
              </div>

              {transaction?.description && (
                <div className="field-row full-width">
                  <span className="field-label">Description</span>
                  <span className="field-value">
                    {transaction.description}
                  </span>
                </div>
              )}

              <div className="field-row">
                <span className="field-label">Created on</span>
                <span className="field-value tooltip-wrapper">
                  {new Date(transaction.created_on).toLocaleString()}
                  <img
                    src={`${process.env.PUBLIC_URL}/questionmark_icon.png`}
                    width="16"
                    height="16"
                    className="questionmark"
                    alt="info"
                  />
                  <span className="questionmark_tooltip">
                    The date and time when the transaction was added in the
                    system.
                  </span>
                </span>
              </div>

              {transaction?.tags?.length > 0 && (
                <div className="field-row full-width">
                  <span className="field-label">Tags</span>
                  <span className="tags-list">
                    {transaction.tags.map((t) => (
                      <span key={t.id} className="tag">
                        {t.name}
                      </span>
                    ))}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Options bar ── */}
          <div className="options">
            <button onClick={handleDelete} id="deleteButton">
              🗑 Delete
            </button>
            <button
              id="editButton"
              onClick={() => showToast("Not implemented yet.")}
            >
              ✏️ Edit
            </button>
            {canRepeat && (
              <button
                id="repeatTransactionButton"
                onClick={handleRepeatTransaction}
              >
                🔁 Repeat
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default TransactionPopup;
