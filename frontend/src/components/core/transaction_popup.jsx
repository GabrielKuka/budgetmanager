import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useConfirm } from "../../context/ConfirmContext";
import { useGlobalContext } from "../../context/GlobalContext";
import { useToast } from "../../context/ToastContext";
import transactionService from "../../services/transactionService/transactionService";
import { helper } from "../helper";
import "./transaction_popup.scss";

const TYPE_META = {
  expense: { icon: "💸", verb: "Spent", dateLabel: "Paid on" },
  income: { icon: "💰", verb: "Earned", dateLabel: "Earned on" },
  transfer: { icon: "🔄", verb: "Transferred", dateLabel: "Transferred on" },
  buy: { icon: "📈", verb: "Bought", dateLabel: "Bought on" },
  sell: { icon: "📉", verb: "Sold", dateLabel: "Sold on" },
};

const EDITABLE_TYPES = ["income", "expense", "transfer"];

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
  const typeMeta = TYPE_META[transactionType] || {};

  const [isPinned, setIsPinned] = useState(transaction.pinned);
  const [isEditing, setIsEditing] = useState(false);

  const [editDate, setEditDate] = useState(transaction.date);
  const [editAmount, setEditAmount] = useState(transaction.amount);
  const [editDescription, setEditDescription] = useState(
    transaction.description || ""
  );
  const [editTags, setEditTags] = useState(
    transaction.tags?.map((t) => t.name) || []
  );
  const [editCategory, setEditCategory] = useState(transaction.category || "");
  const [editFromAccount, setEditFromAccount] = useState(
    transaction.from_account || ""
  );
  const [editFromCashBalance, setEditFromCashBalance] = useState(
    transaction.from_cash_balance || ""
  );
  const [editToAccount, setEditToAccount] = useState(
    transaction.to_account || ""
  );
  const [editToCashBalance, setEditToCashBalance] = useState(
    transaction.to_cash_balance || ""
  );
  const [editTagInput, setEditTagInput] = useState("");

  const isTransfer = transactionType === "transfer";
  const isIncome = transactionType === "income";
  const isExpense = transactionType === "expense";
  const isSecurity = transactionType === "buy" || transactionType === "sell";
  const canEdit = EDITABLE_TYPES.includes(transactionType);
  const canRepeat = isIncome || isExpense;

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        if (isEditing) {
          handleCancelEdit();
        } else {
          closePopup();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isEditing]);

  const cashBalanceOptions = useMemo(() => {
    const options = [];
    (global.activeAccounts || []).forEach((account) => {
      (account.cash_balances || []).forEach((balance) => {
        options.push({
          id: balance.id,
          accountId: account.id,
          accountName: account.name,
          currencyCode: balance.currency?.code || account.currency,
          balance: balance.balance,
        });
      });
    });
    return options.sort((a, b) =>
      `${a.accountName}-${a.currencyCode}`.localeCompare(
        `${b.accountName}-${b.currencyCode}`
      )
    );
  }, [global.activeAccounts]);

  const getBalancesByAccountId = (accountId) =>
    cashBalanceOptions.filter((cb) => cb.accountId === Number(accountId));

  const getAutoCashBalanceId = (accountId) => {
    const balances = getBalancesByAccountId(accountId);
    if (balances.length === 1) return String(balances[0].id);
    const positive = balances.filter((b) => Number(b.balance || 0) > 0);
    if (positive.length === 1) return String(positive[0].id);
    return "";
  };

  const getBalanceCurrency = (balanceId) => {
    const cb = cashBalanceOptions.find((item) => item.id === Number(balanceId));
    return cb?.currencyCode || "";
  };

  let categories = [];
  if (isIncome) categories = global.incomeCategories;
  else if (isExpense) categories = global.expenseCategories;

  function getCategory(id) {
    if (id == null) return "Uncategorized";
    const cat = categories?.filter((c) => c.id === id);
    return cat?.length === 1 ? cat[0]?.category : "Uncategorized";
  }

  function getTransactionCurrency() {
    return helper.getTransactionCurrency(
      global.accounts,
      transaction,
      getAccountCurrency
    );
  }

  function getAccountId() {
    if (isIncome || transactionType === "sell") return transaction.to_account;
    return transaction.from_account;
  }

  function closePopup() {
    showPopup(false);
  }

  function handlePinToggle() {
    setIsPinned((prev) => !prev);
    global.toggleTransactionPin(transaction.id);
  }

  function enterEditMode() {
    setEditDate(transaction.date);
    setEditAmount(transaction.amount);
    setEditDescription(transaction.description || "");
    setEditTags(transaction.tags?.map((t) => t.name) || []);
    setEditCategory(transaction.category || "");
    setEditFromAccount(transaction.from_account || "");
    setEditFromCashBalance(transaction.from_cash_balance || "");
    setEditToAccount(transaction.to_account || "");
    setEditToCashBalance(transaction.to_cash_balance || "");
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
  }

  function handleAddTag() {
    const val = editTagInput.trim();
    if (val && !editTags.includes(val)) {
      setEditTags([...editTags, val]);
    }
    setEditTagInput("");
  }

  function handleRemoveTag(tag) {
    setEditTags(editTags.filter((t) => t !== tag));
  }

  function handleDelete() {
    showConfirm(
      `Delete ${transactionType}?`,
      async () => {
        const payload = { type: transactionType, id: transaction.id };
        if (isExpense) await transactionService.deleteExpense(payload);
        else if (isIncome) await transactionService.deleteIncome(payload);
        else await transactionService.deleteTransfer(payload);

        if (refreshSearchResults != null) refreshSearchResults(transaction.id);
        closePopup();
        await refreshTransactions();
        showToast(
          `${
            transactionType[0].toUpperCase() + transactionType.substring(1)
          } deleted.`
        );
      },
      { variant: "danger" }
    );
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
    showConfirm(
      "Repeat transaction?",
      async () => {
        let t_type = null;
        if (isIncome) t_type = 0;
        if (isExpense) t_type = 1;
        if (isTransfer) t_type = 2;

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
      },
      { variant: "info" }
    );
  }

  async function handleSaveEdit() {
    showConfirm(
      "Save changes?",
      async () => {
        const tTypeNum = isIncome ? 0 : isExpense ? 1 : isTransfer ? 2 : null;

        const payload = {
          id: transaction.id,
          type: tTypeNum,
          date: editDate,
          description: editDescription,
          tags: editTags.map((t) => ({ name: t })),
        };

        if (isIncome) {
          payload.amount = editAmount;
          payload.to_cash_balance = Number(editToCashBalance);
          payload.category = Number(editCategory) || null;
        } else if (isExpense) {
          payload.amount = editAmount;
          payload.from_cash_balance = Number(editFromCashBalance);
          payload.category = Number(editCategory) || null;
        } else if (isTransfer) {
          payload.from_amount = editAmount;
          payload.from_cash_balance = Number(editFromCashBalance);
          payload.to_cash_balance = Number(editToCashBalance);
        }

        await transactionService.updateTransaction(payload);
        await refreshTransactions();
        await global.updateAccounts();
        setIsEditing(false);
        showToast("Transaction updated.");
      },
      { variant: "info" }
    );
  }

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

  const accountOptions = useMemo(() => {
    return (global.activeAccounts || []).map((a) => ({
      id: a.id,
      name: a.name,
    }));
  }, [global.activeAccounts]);

  const sourceBalances = getBalancesByAccountId(editFromAccount);
  const destBalances = getBalancesByAccountId(editToAccount);

  const amountCurrency = isIncome
    ? getBalanceCurrency(editToCashBalance)
    : getBalanceCurrency(editFromCashBalance);

  return (
    <>
      <div
        className="overlay"
        onClick={isEditing ? undefined : closePopup}
      ></div>
      <div
        className={`transaction-popup-wrapper${
          transaction.is_draft ? " is-draft" : ""
        }`}
      >
        <div className="title-bar">
          <div className="main">
            <span className="type-icon">{typeMeta.icon}</span>
            <div className="title-area">
              <span className="title">
                {isEditing
                  ? "Edit Transaction"
                  : `${typeMeta.verb} ${amountDisplay} ${helper.getCurrency(
                      currency
                    )}`}
              </span>
              <span className="date">
                {typeMeta.dateLabel} {transaction.date}
              </span>
            </div>
            {!isEditing && transaction.is_draft && (
              <span className="draft-badge-popup">DRAFT</span>
            )}
            {!isEditing && (
              <button
                className={`pin-badge${isPinned ? " pinned" : ""}`}
                onClick={handlePinToggle}
                title={isPinned ? "Unpin transaction" : "Pin transaction"}
              >
                {isPinned ? "📌 Pinned" : "📌 Pin"}
              </button>
            )}
          </div>
          <button className="close-popup" onClick={closePopup}>
            ✕
          </button>
        </div>

        <div className="content">
          {isEditing ? (
            <>
              <div className="section">
                <div className="section-heading">Transaction Details</div>
                <div className="edit-grid">
                  <div className="edit-field">
                    <label className="edit-label" htmlFor="editDate">
                      Date
                    </label>
                    <input
                      id="editDate"
                      type="date"
                      className="edit-input"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                    />
                  </div>

                  <div className="edit-field">
                    <label className="edit-label" htmlFor="editAmount">
                      Amount
                    </label>
                    <div className="amount-input-row">
                      <input
                        id="editAmount"
                        type="text"
                        className="edit-input"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                      />
                      <span className="amount-currency-chip">
                        {amountCurrency || helper.getCurrency(currency) || "-"}
                      </span>
                    </div>
                  </div>

                  {(isExpense || isTransfer) && (
                    <div className="edit-field account-balance-row">
                      <div className="account-balance-pair">
                        <div>
                          <label
                            className="edit-label"
                            htmlFor="editFromAccount"
                          >
                            {isTransfer ? "From Account" : "Account"}
                          </label>
                          <select
                            id="editFromAccount"
                            className="edit-input"
                            value={editFromAccount}
                            onChange={(e) => {
                              setEditFromAccount(e.target.value);
                              setEditFromCashBalance(
                                getAutoCashBalanceId(e.target.value)
                              );
                            }}
                          >
                            <option value="" disabled>
                              Select account
                            </option>
                            {accountOptions.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label
                            className="edit-label"
                            htmlFor="editFromCashBalance"
                          >
                            Cash Balance
                          </label>
                          <select
                            id="editFromCashBalance"
                            className="edit-input"
                            value={editFromCashBalance}
                            onChange={(e) =>
                              setEditFromCashBalance(e.target.value)
                            }
                            disabled={!editFromAccount}
                          >
                            <option value="" disabled>
                              Select balance
                            </option>
                            {sourceBalances.map((cb) => (
                              <option key={cb.id} value={cb.id}>
                                {cb.currencyCode} {cb.accountName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {isTransfer && (
                    <div className="edit-field account-balance-row">
                      <div className="account-balance-pair">
                        <div>
                          <label className="edit-label" htmlFor="editToAccount">
                            To Account
                          </label>
                          <select
                            id="editToAccount"
                            className="edit-input"
                            value={editToAccount}
                            onChange={(e) => {
                              setEditToAccount(e.target.value);
                              setEditToCashBalance(
                                getAutoCashBalanceId(e.target.value)
                              );
                            }}
                          >
                            <option value="" disabled>
                              Select account
                            </option>
                            {accountOptions.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label
                            className="edit-label"
                            htmlFor="editToCashBalance"
                          >
                            Cash Balance
                          </label>
                          <select
                            id="editToCashBalance"
                            className="edit-input"
                            value={editToCashBalance}
                            onChange={(e) =>
                              setEditToCashBalance(e.target.value)
                            }
                            disabled={!editToAccount}
                          >
                            <option value="" disabled>
                              Select balance
                            </option>
                            {destBalances.map((cb) => (
                              <option key={cb.id} value={cb.id}>
                                {cb.currencyCode} {cb.accountName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {isIncome && (
                    <div className="edit-field account-balance-row">
                      <div className="account-balance-pair">
                        <div>
                          <label className="edit-label" htmlFor="editToAccount">
                            Account
                          </label>
                          <select
                            id="editToAccount"
                            className="edit-input"
                            value={editToAccount}
                            onChange={(e) => {
                              setEditToAccount(e.target.value);
                              setEditToCashBalance(
                                getAutoCashBalanceId(e.target.value)
                              );
                            }}
                          >
                            <option value="" disabled>
                              Select account
                            </option>
                            {accountOptions.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label
                            className="edit-label"
                            htmlFor="editToCashBalance"
                          >
                            Cash Balance
                          </label>
                          <select
                            id="editToCashBalance"
                            className="edit-input"
                            value={editToCashBalance}
                            onChange={(e) =>
                              setEditToCashBalance(e.target.value)
                            }
                            disabled={!editToAccount}
                          >
                            <option value="" disabled>
                              Select balance
                            </option>
                            {destBalances.map((cb) => (
                              <option key={cb.id} value={cb.id}>
                                {cb.currencyCode} {cb.accountName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {(isIncome || isExpense) && (
                    <div className="edit-field">
                      <label className="edit-label" htmlFor="editCategory">
                        Category
                      </label>
                      <select
                        id="editCategory"
                        className="edit-input"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                      >
                        <option value="" disabled>
                          Choose category
                        </option>
                        {categories?.map((c) => (
                          <option key={c.id} value={c.id}>
                            {helper.categoryIcon(c.id)} {c.category}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="section">
                <div className="section-heading">Description & Tags</div>
                <div className="edit-grid">
                  <div className="edit-field full-width">
                    <label className="edit-label" htmlFor="editDescription">
                      Description
                    </label>
                    <textarea
                      id="editDescription"
                      className="edit-input edit-textarea"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Add a description..."
                    />
                  </div>

                  <div className="edit-field full-width">
                    <label className="edit-label">Tags</label>
                    <div className="tag-input-row">
                      <input
                        type="text"
                        className="edit-input"
                        placeholder="Enter tag..."
                        value={editTagInput}
                        onChange={(e) => setEditTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="add-tag-btn"
                        onClick={handleAddTag}
                      >
                        + Tag
                      </button>
                    </div>
                    {editTags.length > 0 && (
                      <div className="edit-tags-list">
                        {editTags.map((tag) => (
                          <span key={tag} className="edit-tag">
                            {tag}
                            <button
                              type="button"
                              className="edit-tag-remove"
                              onClick={() => handleRemoveTag(tag)}
                            >
                              x
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="options">
                <button onClick={handleSaveEdit} id="saveButton">
                  💾 Save
                </button>
                <button onClick={handleCancelEdit} id="cancelButton">
                  ✕ Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="section">
                <div className="section-heading">Overview</div>
                <div className="field-grid">
                  <div className="field-row full-width amount-field">
                    <span className="field-label">Amount</span>
                    <span
                      className="field-value"
                      style={{ color: amountColor }}
                    >
                      {amountDisplay} {helper.getCurrency(currency)}
                    </span>
                  </div>
                  <div className="field-row">
                    <span className="field-label">
                      {isSecurity || isTransfer ? "From Account" : "Account"}
                    </span>
                    <span
                      className="field-value account_name"
                      style={helper.accountLabelStyle(
                        global.accounts,
                        accountId
                      )}
                      onClick={() => navigate(`/accounts/${accountId}`)}
                    >
                      {accountName}
                    </span>
                  </div>
                  {(isTransfer || transactionType === "sell") && (
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
                  {(isIncome || isExpense) && (
                    <div className="field-row">
                      <span className="field-label">Category</span>
                      <span className="field-value">
                        {categoryEmoji} {categoryName}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {isSecurity && (
                <div className="section">
                  <div className="section-heading">Security Details</div>
                  <div className="field-grid">
                    <div className="field-row">
                      <span className="field-label">Security ID</span>
                      <span className="field-value">
                        {transaction.security}
                      </span>
                    </div>
                    <div className="field-row">
                      <span className="field-label">Quantity</span>
                      <span className="field-value">{quantDisplay}</span>
                    </div>
                    <div className="field-row">
                      <span className="field-label">Price / Unit</span>
                      <span className="field-value">
                        {priceDisplay}{" "}
                        {helper.getCurrency(getAccountCurrency(accountId))}
                      </span>
                    </div>
                    {transaction.holding && (
                      <div className="field-row">
                        <span className="field-label">Holding ID</span>
                        <span className="field-value">
                          {transaction.holding}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="section">
                <div className="section-heading">Metadata</div>
                <div className="field-grid">
                  <div className="field-row">
                    <span className="field-label">ID</span>
                    <span className="field-value">#{transaction.id}</span>
                  </div>
                  <div className="field-row">
                    <span className="field-label">User</span>
                    <span className="field-value">{global.user.data.name}</span>
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

              <div className="options">
                <button onClick={handleDelete} id="deleteButton">
                  🗑 Delete
                </button>
                {canEdit && (
                  <button onClick={enterEditMode} id="editButton">
                    ✏️ Edit
                  </button>
                )}
                {canRepeat && (
                  <button
                    id="repeatTransactionButton"
                    onClick={handleRepeatTransaction}
                  >
                    🔁 Repeat
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default TransactionPopup;
