import React from "react";
import "./templates.scss";
import { helper } from "../helper";
import { useGlobalContext } from "../../context/GlobalContext";

const TemplateItem = (props) => {
  const global = useGlobalContext();
  const type = () => {
    if (props.i?.type == 0) return "income";
    if (props.i?.type == 1) return "expense";
    if (props.i?.type == 2) return "transfer";
  };

  const account = props.i?.account;
  const from_account = props.i?.from_account;
  const to_account = props.i?.to_account;

  const amount = props.i?.amount;
  const category = props.i?.category;

  function getAccountCurrency(id) {
    const account = global.accounts?.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  function getAccount(id) {
    const res = global.accounts?.filter((a) => a.id == id);
    return res.length == 1 ? res[0].name : "";
  }
  function getCategory(id) {
    if (props.i.type == 0) {
      const res = props.incomeCategories?.filter((c) => c.id == id);
      return res.length == 1 ? res[0].category : "";
    }
    if (props.i.type == 1) {
      const res = props.expenseCategories?.filter((c) => c.id == id);
      return res.length == 1 ? res[0].category : "";
    }
  }

  return (
    <div className={"template-item"}>
      {type() == "income" && (
        <label>
          Earn{" "}
          <b>
            {helper.formatNumber(amount)}{" "}
            {helper.getCurrency(getAccountCurrency(account))}
          </b>{" "}
          to{" "}
          <i style={helper.accountLabelStyle(global.accounts, account)}>
            {getAccount(account)}
          </i>{" "}
          as {getCategory(category)}
        </label>
      )}
      {type() == "expense" && (
        <label>
          Spend{" "}
          <b>
            {helper.formatNumber(amount)}{" "}
            {helper.getCurrency(getAccountCurrency(account))}
          </b>{" "}
          from{" "}
          <i style={helper.accountLabelStyle(global.accounts, account)}>
            {getAccount(account)}
          </i>{" "}
          on {getCategory(category)}
        </label>
      )}
      {type() == "transfer" && (
        <label>
          Transfer{" "}
          <b>
            {helper.formatNumber(amount)}{" "}
            {helper.getCurrency(getAccountCurrency(from_account))}
          </b>{" "}
          from{" "}
          <i style={helper.accountLabelStyle(global.accounts, from_account)}>
            {getAccount(from_account)}
          </i>{" "}
          to{" "}
          <i style={helper.accountLabelStyle(global.accounts, to_account)}>
            {getAccount(to_account)}
          </i>
        </label>
      )}
    </div>
  );
};
export default TemplateItem;
