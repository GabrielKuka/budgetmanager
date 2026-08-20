import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGlobalContext } from "../../context/GlobalContext";
import { useToast } from "../../context/ToastContext";
import currencyService from "../../services/currencyService";
import tangibleAssetService from "../../services/tangibleAssetService";
import transactionService from "../../services/transactionService/transactionService";
import "./transactionComposer.scss";

const TYPES = [
  ["expense", "Expense", 1],
  ["income", "Income", 0],
  ["transfer", "Transfer", 2],
  ["buy", "Buy security", 3],
  ["sell", "Sell security", 4],
];
const today = () => new Date().toISOString().slice(0, 10);
const format = (value, digits = 2) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(
    Number(value || 0)
  );

export default function TransactionComposer({
  initialType = "",
  initialHolding = "",
  onClose,
  onComplete,
}) {
  const global = useGlobalContext();
  const opener = useRef(document.activeElement);
  const toast = useToast();
  const [type, setType] = useState(initialType);
  const [values, setValues] = useState({
    date: today(),
    description: "",
    amount: "",
    quantity: "",
    price: "",
    security: "",
    holding: initialHolding ? String(initialHolding) : "",
    category: "",
    fromAccount: "",
    toAccount: "",
    fromBalance: "",
    toBalance: "",
    rate: "",
  });
  const [tags, setTags] = useState([]);
  const [tag, setTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [securityResults, setSecurityResults] = useState([]);
  const accounts = useMemo(
    () => global.activeAccounts || [],
    [global.activeAccounts]
  );
  const accountOptions = useMemo(
    () => accounts.filter((a) => a.cash_balances?.length),
    [accounts]
  );
  const holdings = useMemo(
    () =>
      accounts
        .flatMap((a) => (a.holdings || []).map((h) => ({ ...h, account: a })))
        .filter((h) => Number(h.quantity) > 0),
    [accounts]
  );
  const balances = (id) =>
    accounts.find((a) => String(a.id) === String(id))?.cash_balances || [];
  const autoBalance = (id) => {
    const list = balances(id);
    const positive = list.filter((b) => Number(b.balance) > 0);
    return String(
      (list.length === 1 ? list[0] : positive.length === 1 ? positive[0] : {})
        .id || ""
    );
  };
  const balance = useCallback(
    (id) =>
      accounts
        .flatMap((a) => a.cash_balances || [])
        .find((b) => String(b.id) === String(id)),
    [accounts]
  );
  const set = (key, value) => setValues((old) => ({ ...old, [key]: value }));
  const selectAccount = (key, account) => {
    const balanceKey = key === "fromAccount" ? "fromBalance" : "toBalance";
    setValues((old) => ({
      ...old,
      [key]: account,
      [balanceKey]: autoBalance(account),
    }));
  };

  useEffect(() => {
    const run = async () => {
      if (type !== "buy" || values.security.trim().length < 1)
        return setSecurityResults([]);
      try {
        setSecurityResults(
          await tangibleAssetService.securities(values.security)
        );
      } catch {
        setSecurityResults([]);
      }
    };
    const id = setTimeout(run, 180);
    return () => clearTimeout(id);
  }, [type, values.security]);
  useEffect(() => {
    const source =
      balance(values.fromBalance)?.currency?.code ||
      balance(values.fromBalance)?.currency;
    const destination =
      balance(values.toBalance)?.currency?.code ||
      balance(values.toBalance)?.currency;
    if (
      type !== "transfer" ||
      !source ||
      !destination ||
      source === destination
    )
      return set("rate", "");
    currencyService
      .convert(source, destination, 1)
      .then((rate) => set("rate", rate))
      .catch(() => set("rate", ""));
  }, [balance, type, values.fromBalance, values.toBalance]);
  useEffect(() => {
    const openerElement = opener.current;
    const escape = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", escape);
    document.body.classList.add("modal-open");
    return () => {
      window.removeEventListener("keydown", escape);
      document.body.classList.remove("modal-open");
      openerElement?.focus?.();
    };
  }, [onClose]);

  const usesFrom = ["expense", "transfer", "buy"].includes(type);
  const usesTo = ["income", "transfer", "sell"].includes(type);
  const addTag = () => {
    const clean = tag.trim();
    if (clean && !tags.includes(clean)) setTags([...tags, clean]);
    setTag("");
  };
  const reset = () => {
    setValues({
      date: today(),
      description: "",
      amount: "",
      quantity: "",
      price: "",
      security: "",
      holding: initialHolding ? String(initialHolding) : "",
      category: "",
      fromAccount: "",
      toAccount: "",
      fromBalance: "",
      toBalance: "",
      rate: "",
    });
    setTags([]);
    setError("");
  };
  const submit = async (draft = false) => {
    setError("");
    const typeNumber = TYPES.find((item) => item[0] === type)?.[2];
    if (typeNumber === undefined) return setError("Choose a transaction type.");
    const payload = {
      type: typeNumber,
      date: values.date,
      description: values.description,
      tags: tags.map((name) => ({ name })),
      ...(draft ? { is_draft: true } : {}),
    };
    if (type === "expense" || type === "income") {
      if (
        !values.amount ||
        !values.category ||
        !(type === "expense" ? values.fromBalance : values.toBalance)
      )
        return setError("Complete amount, category, and cash balance.");
      Object.assign(payload, {
        amount: values.amount,
        category: Number(values.category),
        [type === "expense" ? "from_cash_balance" : "to_cash_balance"]: Number(
          type === "expense" ? values.fromBalance : values.toBalance
        ),
      });
    }
    if (type === "transfer") {
      if (!values.amount || !values.fromBalance || !values.toBalance)
        return setError("Complete amount and both cash balances.");
      Object.assign(payload, {
        from_amount: values.amount,
        from_cash_balance: Number(values.fromBalance),
        to_cash_balance: Number(values.toBalance),
      });
      if (values.rate) payload.fx_rate = Number(values.rate);
    }
    if (type === "buy") {
      if (
        !values.security ||
        !values.quantity ||
        !values.price ||
        !values.fromBalance
      )
        return setError(
          "Complete security, quantity, price, and source balance."
        );
      Object.assign(payload, {
        security: values.security,
        quantity: values.quantity,
        price_per_unit: values.price,
        from_cash_balance: Number(values.fromBalance),
      });
    }
    if (type === "sell") {
      if (
        !values.holding ||
        !values.quantity ||
        !values.price ||
        !values.toBalance
      )
        return setError(
          "Complete holding, quantity, price, and destination balance."
        );
      Object.assign(payload, {
        holding: Number(values.holding),
        quantity: values.quantity,
        price_per_unit: values.price,
        to_cash_balance: Number(values.toBalance),
      });
    }
    setSaving(true);
    try {
      await transactionService.addTransaction(payload);
      await Promise.all([global.updateTransactions(), global.updateAccounts()]);
      toast(
        draft
          ? "Draft saved."
          : `${TYPES.find((item) => item[0] === type)[1]} added.`
      );
      await onComplete?.();
      onClose();
    } catch (err) {
      const data = err?.response?.data;
      setError(
        typeof data === "object"
          ? Object.values(data).flat().join(" ")
          : "Could not save transaction."
      );
    } finally {
      setSaving(false);
    }
  };
  const cashSelector = (side) => {
    const accountKey = side === "from" ? "fromAccount" : "toAccount";
    const balanceKey = side === "from" ? "fromBalance" : "toBalance";
    const selected = balances(values[accountKey]);
    return (
      <div className="transaction-composer__grid">
        <label>
          {side === "from" ? "Source account" : "Destination account"}
          <select
            value={values[accountKey]}
            onChange={(e) => selectAccount(accountKey, e.target.value)}
          >
            <option value="">Select account</option>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {side === "from" ? "Source cash balance" : "Destination cash balance"}
          <select
            value={values[balanceKey]}
            disabled={!values[accountKey]}
            onChange={(e) => set(balanceKey, e.target.value)}
          >
            <option value="">Select balance</option>
            {selected.map((b) => (
              <option key={b.id} value={b.id}>
                {b.currency?.code || b.currency} · {format(b.balance)}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  };
  const categoryOptions =
    type === "income" ? global.incomeCategories : global.expenseCategories;
  return createPortal(
    <div
      className="transaction-composer"
      role="dialog"
      aria-modal="true"
      aria-label="Transaction composer"
    >
      <div className="transaction-composer__backdrop" onMouseDown={onClose} />
      <section className="transaction-composer__sheet">
        <header>
          <div>
            <p className="eyebrow">New entry</p>
            <h2>
              {type
                ? TYPES.find((item) => item[0] === type)?.[1]
                : "Add transaction"}
            </h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="transaction-composer__body">
          <label>
            Transaction type
            <select
              autoFocus
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                reset();
              }}
            >
              <option value="">Choose transaction type</option>
              {TYPES.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {type && (
            <>
              <label>
                Date
                <input
                  type="date"
                  value={values.date}
                  onChange={(e) => set("date", e.target.value)}
                />
              </label>
              {usesFrom && cashSelector("from")}
              {usesTo && cashSelector("to")}
              {["expense", "income", "transfer"].includes(type) && (
                <label>
                  Amount
                  <input
                    inputMode="decimal"
                    value={values.amount}
                    onChange={(e) => set("amount", e.target.value)}
                    placeholder="0.00"
                  />
                </label>
              )}
              {["expense", "income"].includes(type) && (
                <label>
                  Category
                  <select
                    value={values.category}
                    onChange={(e) => set("category", e.target.value)}
                  >
                    <option value="">Choose category</option>
                    {categoryOptions?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.category}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {type === "buy" && (
                <label>
                  Security
                  <input
                    value={values.security}
                    onChange={(e) => set("security", e.target.value)}
                    placeholder="Ticker or security name"
                  />
                  {securityResults.length > 0 && (
                    <div className="transaction-composer__results">
                      {securityResults.map((security) => (
                        <button
                          type="button"
                          key={security.id || security.ticker}
                          onClick={() => {
                            set("security", security.ticker);
                            setSecurityResults([]);
                          }}
                        >
                          <b>{security.ticker}</b>
                          <span>{security.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </label>
              )}
              {type === "sell" && (
                <label>
                  Holding
                  <select
                    value={values.holding}
                    onChange={(e) => set("holding", e.target.value)}
                  >
                    <option value="">Select holding</option>
                    {holdings.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.account.name} · {h.security?.ticker} —{" "}
                        {format(h.quantity, 4)} units
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {["buy", "sell"].includes(type) && (
                <div className="transaction-composer__grid">
                  <label>
                    Quantity
                    <input
                      inputMode="decimal"
                      value={values.quantity}
                      onChange={(e) => set("quantity", e.target.value)}
                    />
                  </label>
                  <label>
                    Price per unit
                    <input
                      inputMode="decimal"
                      value={values.price}
                      onChange={(e) => set("price", e.target.value)}
                    />
                  </label>
                </div>
              )}
              {type === "transfer" && values.rate !== "" && (
                <label>
                  Exchange rate
                  <input
                    inputMode="decimal"
                    value={values.rate}
                    onChange={(e) => set("rate", e.target.value)}
                  />
                </label>
              )}
              <label>
                Description
                <textarea
                  rows="3"
                  value={values.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Optional description"
                />
              </label>
              <div className="transaction-composer__tags">
                <input
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Add tag"
                />
                <button type="button" onClick={addTag}>
                  + Tag
                </button>
              </div>
              {tags.length > 0 && (
                <div className="transaction-composer__chips">
                  {tags.map((item) => (
                    <span key={item}>
                      {item}
                      <button
                        type="button"
                        onClick={() =>
                          setTags(tags.filter((current) => current !== item))
                        }
                        aria-label={`Remove ${item}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {error && <p className="transaction-composer__error">{error}</p>}
            </>
          )}
        </div>
        <footer>
          <button type="button" className="secondary-button" onClick={reset}>
            Reset
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!type || saving}
            onClick={() => submit(true)}
          >
            Save draft
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!type || saving}
            onClick={() => submit(false)}
          >
            {saving
              ? "Saving…"
              : type
              ? `Add ${TYPES.find(
                  (item) => item[0] === type
                )?.[1].toLowerCase()}`
              : "Continue"}
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
}
