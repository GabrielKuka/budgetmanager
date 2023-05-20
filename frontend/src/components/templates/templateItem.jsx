import React from "react";
import "./templates.scss";

const TemplateItem = (props) => {
  const type = () => {
    if (props.i.type == 0) return "income";
    if (props.i.type == 1) return "expense";
    if (props.i.type == 2) return "transfer";
  };

  const allAccounts = props.accounts;

  const account = props.i.account;
  const from_account = props.i.from_account;
  const to_account = props.i.to_account;

  const amount = props.i.amount;
  const category = props.i.category;

  function getAccount(id) {
    const res = allAccounts.filter((a) => a.id == id);
    return res.length == 1 ? res[0].name : "";
  }
  function getCategory(id) {
    if (props.i.type == 0) {
      const res = props.incomeCategories.filter((c) => c.id == id);
      return res.length == 1 ? res[0].category_type : "";
    }
    if (props.i.type == 1) {
      const res = props.expenseCategories.filter((c) => c.id == id);
      return res.length == 1 ? res[0].category_type : "";
    }
  }

  return (
    <div className={"template-item"}>
      {type() == "income" && (
        <label>
          Earn <b>{amount}€</b> to <i>{getAccount(account)}</i> as{" "}
          {getCategory(category)}
        </label>
      )}
      {type() == "expense" && (
        <label>
          Spend <b>{amount}€</b> from <i>{getAccount(account)}</i> on{" "}
          {getCategory(category)}
        </label>
      )}
      {type() == "transfer" && (
        <label>
          Transfer <b>{amount}€</b> from <i>{getAccount(from_account)}</i> to{" "}
          <i>{getAccount(to_account)}</i>
        </label>
      )}
    </div>
  );
};
export default TemplateItem;
