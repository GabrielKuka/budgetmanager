import React, { useState, useEffect, useRef } from "react";
import TransactionItem from "./transactionItem";
import transactionService from "../../services/transactionService/transactionService";
import "./transfers.scss";
import NoDataCard from "../core/nodata";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { helper } from "../helper";
import TransactionPopup from "../core/transaction_popup";
import currencyService from "../../services/currencyService";
import { useGlobalContext } from "../../context/GlobalContext";
import LoadingCard from "../core/LoadingCard";
import MonthPicker from "../core/MonthPicker";

const Transfers = () => {
  const global = useGlobalContext();
  const accounts = global.activeAccounts || [];
  const accountsLoaded =
    Array.isArray(global.accounts) && Array.isArray(global.activeAccounts);
  const [transactionPopup, setTransactionPopup] = useState(false);
  const [showDrafts, setShowDrafts] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [shownTransfers, setShownTransfers] = useState([]);

  function getAccountCurrency(id) {
    const account = global.accounts?.find((a) => Number(a.id) === Number(id));
    if (account) {
      return account.currency;
    }

    return accountsLoaded ? "Not Found" : null;
  }

  return (
    <div className={"transfers-wrapper"}>
      <Sidebar
        transfers={global.transfers}
        accounts={accounts}
        getAccountCurrency={getAccountCurrency}
      />
      <div className="transfers-wrapper__content">
        <MonthPicker
          showDrafts={showDrafts}
          setShowDrafts={setShowDrafts}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
        {!global.transfers || !accountsLoaded ? (
          <LoadingCard header="Loading Transfers..." />
        ) : global.transfers && !global.transfers?.length ? (
          <NoDataCard
            header={"No transfers found."}
            label={"Add a transfer"}
            focusOn={"date"}
          />
        ) : (
          <TransfersList
            transfers={global.transfers}
            shownTransfers={shownTransfers}
            setShownTransfers={setShownTransfers}
            accounts={accounts}
            getAccountCurrency={getAccountCurrency}
            refreshTransfers={global.updateTransfers}
            setTransactionPopup={setTransactionPopup}
            dateRange={global.dateRange}
            showDrafts={showDrafts}
            searchTerm={searchTerm}
          />
        )}
        {transactionPopup && (
          <TransactionPopup
            transaction={transactionPopup}
            type={2}
            showPopup={setTransactionPopup}
            refreshTransactions={global.updateTransfers}
            getAccountCurrency={getAccountCurrency}
            accounts={accounts}
          />
        )}
      </div>
    </div>
  );
};

const Sidebar = ({ transfers, accounts, getAccountCurrency }) => {
  const global = useGlobalContext();
  const [netFlows, setNetFlows] = useState([]);

  useEffect(() => {
    let active = true;
    async function computeNetFlows() {
      const shown = (transfers || []).filter((t) => !t.is_draft);
      const accMap = {};
      for (const t of shown) {
        // Outflow from source account (in source currency)
        const fromCurrency =
          t.from_currency || getAccountCurrency(t.from_account);
        const toCurrency = t.to_currency || getAccountCurrency(t.to_account);

        const outflowGlobal = parseFloat(
          await currencyService.convert(
            fromCurrency,
            global.globalCurrency,
            t.amount
          )
        );
        const inflowGlobal = parseFloat(
          await currencyService.convert(
            toCurrency,
            global.globalCurrency,
            t.to_amount != null ? t.to_amount : t.amount
          )
        );

        if (!accMap[t.from_account]) {
          accMap[t.from_account] = 0;
        }
        accMap[t.from_account] -= outflowGlobal;

        if (!accMap[t.to_account]) {
          accMap[t.to_account] = 0;
        }
        accMap[t.to_account] += inflowGlobal;
      }

      const rows = Object.keys(accMap).map((id) => ({
        id,
        name: accounts?.find((a) => a.id === Number(id))?.name || "Not found",
        net: accMap[id],
      }));
      rows.sort((a, b) => b.net - a.net);
      if (active) {
        setNetFlows(rows);
      }
    }
    computeNetFlows();
    return () => {
      active = false;
    };
  }, [transfers, accounts, global.globalCurrency]);

  return (
    <div className={"transfers-wrapper__sidebar"}>
      <div className="net-flow-card">
        <div className="chart-title">Net transfer flow</div>
        {netFlows.length === 0 ? (
          <div className="net-flow-card__empty">No transfers this period.</div>
        ) : (
          <ul className="net-flow-list">
            {netFlows.map((row) => (
              <li key={row.id} className="net-flow-list__item">
                <span className="net-flow-list__name">{row.name}</span>
                <span
                  className={`net-flow-list__value ${
                    row.net >= 0 ? "positive" : "negative"
                  }`}
                >
                  {helper.showOrMask(
                    global.privacyMode,
                    helper.formatNumber(row.net)
                  )}
                  {helper.getCurrency(global.globalCurrency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const TransfersList = ({
  transfers,
  shownTransfers,
  setShownTransfers,
  accounts,
  getAccountCurrency,
  refreshTransfers,
  setTransactionPopup,
  dateRange,
  showDrafts,
  searchTerm,
}) => {
  const global = useGlobalContext();
  const [sortedBy, setSortedBy] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionActive, setSelectionActive] = useState(false);
  const [selectedSum, setSelectedSum] = useState(0);
  const showToast = useToast();
  const showConfirm = useConfirm();
  const listRef = useRef(null);

  useEffect(() => {
    let active = true;
    async function computeSelectedSum() {
      if (selectedIds.length === 0) {
        setSelectedSum(0);
        return;
      }
      const selected = (shownTransfers || []).filter((e) =>
        selectedIds.includes(e.id)
      );
      const converted = await Promise.all(
        selected.map(async (e) => {
          const currency =
            e.from_currency || getAccountCurrency(e.from_account);
          return parseFloat(
            await currencyService.convert(
              currency,
              global.globalCurrency,
              e.amount
            )
          );
        })
      );
      if (active) {
        setSelectedSum(
          parseFloat(converted.reduce((a, b) => a + b, 0).toFixed(2))
        );
      }
    }
    computeSelectedSum();
    return () => {
      active = false;
    };
  }, [selectedIds, shownTransfers, global.globalCurrency]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (selectionActive && !listRef.current?.contains(event.target)) {
        setSelectionActive(false);
        setSelectedIds([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [selectionActive]);

  function matchesSearch(transfer) {
    const term = (searchTerm || "").trim().toLowerCase();
    if (!term) {
      return true;
    }
    const fromName =
      accounts?.find((a) => a.id === transfer.from_account)?.name || "";
    const toName =
      accounts?.find((a) => a.id === transfer.to_account)?.name || "";
    const tags = (transfer.tags || []).map((t) => t.name).join(" ");
    return [
      String(transfer.description || ""),
      String(transfer.amount),
      String(transfer.to_amount || ""),
      fromName,
      toName,
      tags,
    ].some((v) => v.toLowerCase().includes(term));
  }

  useEffect(filterTransfers, [dateRange, transfers, showDrafts, searchTerm]);
  useEffect(filterTransfers, []);

  function filterTransfers() {
    const selectedFromAccount = document.getElementById("from_account")?.value;
    const selectedToAccount = document.getElementById("to_account")?.value;

    const fromDate = dateRange.from;
    const toDate = dateRange.to;

    const toAccountFilter =
      selectedToAccount >= 0
        ? transfers.filter((t) => t.to_account == selectedToAccount)
        : transfers;

    const fromAccountFilter =
      selectedFromAccount >= 0
        ? transfers.filter((t) => t.from_account == selectedFromAccount)
        : transfers;

    const fmtDate = (d) =>
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0");

    const dateFilter = transfers.filter(
      (t) => t.date >= fmtDate(fromDate) && t.date <= fmtDate(toDate)
    );

    let filteredtransfers = toAccountFilter
      .filter((t) => fromAccountFilter.includes(t))
      .filter((t) => dateFilter.includes(t))
      .filter((t) => showDrafts || !t.is_draft)
      .filter((t) => matchesSearch(t))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
    // Pinned transactions always first
    filteredtransfers?.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    setShownTransfers(filteredtransfers);
  }

  function handleLongPress(id) {
    setSelectionActive(true);
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function toggleSelect(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleBulkDelete() {
    showConfirm(
      `Delete ${selectedIds.length} transfer(s)? This cannot be undone.`,
      async () => {
        for (const id of selectedIds) {
          const transfer = shownTransfers.find((e) => e.id === id);
          if (!transfer) {
            continue;
          }
          await transactionService.deleteTransfer({
            type: 2,
            id: transfer.id,
          });
        }
        setSelectedIds([]);
        setSelectionActive(false);
        showToast(`${selectedIds.length} transfer(s) deleted.`);
        await refreshTransfers();
      }
    );
  }
  function sortShownTransfers(by = "") {
    if (!by) {
      return;
    }

    let sorted = null;

    if (by == "date") {
      if ("date" in sortedBy) {
        if (sortedBy["date"] == "ascending") {
          sorted = [...shownTransfers].sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          );
          setSortedBy({ date: "descending" });
        } else {
          sorted = [...shownTransfers].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
          );
          setSortedBy({ date: "ascending" });
        }
      } else {
        sorted = [...shownTransfers].sort(
          (a, b) => new Date(a.date) - new Date(b.date)
        );
        setSortedBy({ date: "ascending" });
      }
      // Pinned transactions always first
      sorted?.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
      setShownTransfers(sorted);
      return;
    }

    if (`${by}` in sortedBy) {
      if (sortedBy[`${by}`] == "ascending") {
        sorted = [...shownTransfers].sort((a, b) => b[`${by}`] - a[`${by}`]);
        setSortedBy({ [by]: "descending" });
      } else {
        sorted = [...shownTransfers].sort((a, b) => a[`${by}`] - b[`${by}`]);
        setSortedBy({ [by]: "ascending" });
      }
    } else {
      sorted = [...shownTransfers].sort((a, b) => a[`${by}`] - b[`${by}`]);
      setSortedBy({ [by]: "ascending" });
    }
    // Pinned transactions always first
    sorted?.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    setShownTransfers(sorted);
  }

  return (
    <div ref={listRef} className={"transfers-wrapper__transfers-list"}>
      <div className={"header"}>
        <div>
          <label onClick={() => sortShownTransfers("date")}>Date:</label>
          {sortedBy["date"] == "ascending" && (
            <img
              src={`${process.env.PUBLIC_URL}/up_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
          {sortedBy["date"] == "descending" && (
            <img
              src={`${process.env.PUBLIC_URL}/down_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
        </div>
        <label>Description</label>
        <div>
          <label onClick={() => sortShownTransfers("from_account")}>
            From Account:
          </label>
          {sortedBy["from_account"] == "ascending" && (
            <img
              src={`${process.env.PUBLIC_URL}/up_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
          {sortedBy["from_account"] == "descending" && (
            <img
              src={`${process.env.PUBLIC_URL}/down_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
          <select
            id="from_account"
            defaultValue={"-1"}
            onChange={filterTransfers}
          >
            <option value="-1">All</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label onClick={() => sortShownTransfers("to_account")}>
            To Account:
          </label>
          {sortedBy["to_account"] == "ascending" && (
            <img
              src={`${process.env.PUBLIC_URL}/up_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
          {sortedBy["to_account"] == "descending" && (
            <img
              src={`${process.env.PUBLIC_URL}/down_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
          <select
            id="to_account"
            defaultValue={"-1"}
            onChange={filterTransfers}
          >
            <option value="-1">All</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label onClick={() => sortShownTransfers("amount")}>Amount</label>
          {sortedBy["amount"] == "ascending" && (
            <img
              src={`${process.env.PUBLIC_URL}/up_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
          {sortedBy["amount"] == "descending" && (
            <img
              src={`${process.env.PUBLIC_URL}/down_arrow_icon.png`}
              width="12"
              height="12"
            />
          )}
        </div>
        <div>
          <label>Exchange Rate</label>
        </div>
      </div>
      <div className={"transfers"}>
        {shownTransfers?.length > 0 &&
          shownTransfers.map((transfer) => (
            <TransactionItem
              key={transfer.id}
              transaction={transfer}
              refreshTransactions={refreshTransfers}
              currency={
                transfer.from_currency ||
                helper.getCurrency(getAccountCurrency(transfer.from_account))
              }
              toCurrency={
                transfer.to_currency ||
                helper.getCurrency(getAccountCurrency(transfer.to_account))
              }
              setTransactionPopup={setTransactionPopup}
              refreshAccounts={global.updateAccounts}
              selectionActive={selectionActive}
              selected={selectedIds.includes(transfer.id)}
              onLongPress={handleLongPress}
              onToggleSelect={toggleSelect}
            />
          ))}
      </div>
      {selectionActive && selectedIds.length > 0 && (
        <div className={"bulk-action-bar"}>
          <span className={"bulk-action-bar__count"}>
            {selectedIds.length} selected ·{" "}
            {helper.showOrMask(
              global.privacyMode,
              helper.formatNumber(selectedSum)
            )}
            {helper.getCurrency(global.globalCurrency)}
          </span>
          <button
            className={"bulk-action-bar__delete"}
            onClick={handleBulkDelete}
          >
            Delete
          </button>
          <button
            className={"bulk-action-bar__clear"}
            onClick={() => {
              setSelectedIds([]);
              setSelectionActive(false);
            }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

export default Transfers;
