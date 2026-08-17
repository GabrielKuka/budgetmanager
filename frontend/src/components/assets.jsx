import { useEffect, useState } from "react";
import { useGlobalContext } from "../context/GlobalContext";
import tangibleAssetService from "../services/tangibleAssetService";
import "./assets.scss";

const TYPES = [
  "real_estate",
  "vehicle",
  "precious_metal",
  "art",
  "collectible",
  "other",
];

export default function Assets() {
  const global = useGlobalContext();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("active");
  const [form, setForm] = useState({
    asset_type: "real_estate",
    acquired_on: new Date().toISOString().slice(0, 10),
    quantity: 1,
  });
  const [purchaseForm, setPurchaseForm] = useState({
    asset_type: "real_estate",
    property_type: "residential",
    date: new Date().toISOString().slice(0, 10),
    quantity: 1,
  });
  const [error, setError] = useState("");

  const refresh = async () => {
    try {
      setData(
        await tangibleAssetService.list({
          status,
          currency: global.globalCurrency,
        })
      );
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Could not load assets.");
    }
  };
  useEffect(() => {
    refresh();
  }, [status, global.globalCurrency]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (event) =>
    setForm({ ...form, [event.target.name]: event.target.value });
  const changePurchase = (event) =>
    setPurchaseForm({
      ...purchaseForm,
      [event.target.name]: event.target.value,
    });
  const importAsset = async (event) => {
    event.preventDefault();
    try {
      await tangibleAssetService.create(form);
      setForm({ ...form, name: "", notes: "" });
      refresh();
    } catch (err) {
      setError(JSON.stringify(err.response?.data || "Could not save asset."));
    }
  };
  const purchaseAsset = async (event) => {
    event.preventDefault();
    try {
      await tangibleAssetService.purchase(purchaseForm);
      setPurchaseForm({
        ...purchaseForm,
        name: "",
        address: "",
        amount: "",
        notes: "",
      });
      await global.updateAccounts();
      refresh();
    } catch (err) {
      setError(
        JSON.stringify(err.response?.data || "Could not purchase asset.")
      );
    }
  };
  const dispose = async (asset) => {
    await tangibleAssetService.dispose(asset.id, {
      date: new Date().toISOString().slice(0, 10),
      reason: "Disposed",
    });
    refresh();
  };
  const undo = async (asset) => {
    await tangibleAssetService.undo(asset.id);
    refresh();
  };

  return (
    <main className="assets-page">
      <h1>Assets</h1>
      {error && <p className="assets-error">{error}</p>}
      <section className="assets-summary">
        <div>
          <small>Tangible assets</small>
          <strong>
            {data?.summary?.currency} {data?.summary?.total ?? "—"}
          </strong>
        </div>
        {data?.summary?.by_type?.map((item) => (
          <div key={item.asset_type}>
            <small>{item.label}</small>
            <strong>{item.amount}</strong>
          </div>
        ))}
      </section>
      <section className="assets-toolbar">
        <label>
          Status{" "}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="sold">Sold</option>
            <option value="disposed">Disposed</option>
            <option value="all">All</option>
          </select>
        </label>
      </section>
      <section className="assets-grid">
        <div className="assets-list">
          {data?.assets?.map((asset) => (
            <article key={asset.id} className="asset-card">
              <div>
                <b>{asset.name}</b>
                <span>{asset.asset_type_display}</span>
              </div>
              <strong>
                {asset.currency.code} {asset.current_value}
              </strong>
              <small>
                {asset.status} · acquired {asset.acquired_on}
              </small>
              {asset.status === "active" && (
                <button onClick={() => dispose(asset)}>Dispose</button>
              )}
              {asset.status !== "active" && (
                <button onClick={() => undo(asset)}>Undo last event</button>
              )}
            </article>
          ))}
        </div>
        <div className="assets-forms">
          <form className="asset-form" onSubmit={purchaseAsset}>
            <h2>Buy an asset</h2>
            <input
              required
              name="name"
              placeholder="Property name"
              value={purchaseForm.name || ""}
              onChange={changePurchase}
            />
            <select
              name="asset_type"
              value={purchaseForm.asset_type}
              onChange={changePurchase}
            >
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace("_", " ")}
                </option>
              ))}
            </select>
            {purchaseForm.asset_type === "real_estate" && (
              <>
                <select
                  name="property_type"
                  value={purchaseForm.property_type}
                  onChange={changePurchase}
                >
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="land">Land</option>
                  <option value="other">Other</option>
                </select>
                <input
                  name="address"
                  placeholder="Address"
                  value={purchaseForm.address || ""}
                  onChange={changePurchase}
                />
              </>
            )}
            <input
              required
              type="date"
              name="date"
              value={purchaseForm.date}
              onChange={changePurchase}
            />
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              name="amount"
              placeholder="Purchase price"
              value={purchaseForm.amount || ""}
              onChange={changePurchase}
            />
            <select
              required
              name="from_cash_balance"
              value={purchaseForm.from_cash_balance || ""}
              onChange={changePurchase}
            >
              <option value="">Pay from cash balance…</option>
              {(global.activeAccounts || []).flatMap((account) =>
                (account.cash_balances || []).map((balance) => (
                  <option key={balance.id} value={balance.id}>
                    {account.name} — {balance.currency.code} {balance.balance}
                  </option>
                ))
              )}
            </select>
            <textarea
              name="notes"
              placeholder="Notes"
              value={purchaseForm.notes || ""}
              onChange={changePurchase}
            />
            <button type="submit">Buy asset</button>
          </form>
          <form className="asset-form" onSubmit={importAsset}>
            <h2>Import existing asset</h2>
            <input
              required
              name="name"
              placeholder="Name"
              value={form.name || ""}
              onChange={change}
            />
            <select name="asset_type" value={form.asset_type} onChange={change}>
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace("_", " ")}
                </option>
              ))}
            </select>
            <input
              required
              type="date"
              name="acquired_on"
              value={form.acquired_on}
              onChange={change}
            />
            <input
              required
              type="number"
              min="0"
              step="0.01"
              name="acquisition_cost"
              placeholder="Acquisition cost"
              onChange={change}
            />
            <input
              required
              type="number"
              name="currency_id"
              placeholder="Currency ID"
              onChange={change}
            />
            {form.asset_type === "real_estate" && (
              <select name="property_type" onChange={change}>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="land">Land</option>
                <option value="other">Other</option>
              </select>
            )}
            <textarea
              name="notes"
              placeholder="Notes"
              value={form.notes || ""}
              onChange={change}
            />
            <button type="submit">Import asset</button>
          </form>
        </div>
      </section>
    </main>
  );
}
