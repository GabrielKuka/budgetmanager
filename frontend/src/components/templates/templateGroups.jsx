import React, { useState } from "react";
import TemplateItem from "./templateItem";
import transactionService from "../../services/transactionService/transactionService";
import "./templates.scss";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { helper } from "../helper";
import currencyService from "../../services/currencyService";
import { useGlobalContext } from "../../context/GlobalContext";

const TemplateGroups = (props) => {
  const global = useGlobalContext();
  const [currentTemplateGroup, setCurrentTemplateGroup] = useState(false);
  const showToast = useToast();
  const showConfirm = useConfirm();

  function currentTemplateGroupStyle() {
    // Get the item we're hovering over
    const currentTemplateGroupElement = document.getElementById(
      `template-group-item-${currentTemplateGroup.id}`
    );

    // Get item's position
    const rect = currentTemplateGroupElement.getBoundingClientRect();

    return {
      border: "1px solid cadetblue",
      boxShadow: "1px 1px 3px #dadada",
      borderRadius: "5px",
      position: "absolute",
      left: "105%",
      top: `${rect.top - 80}px`,
      width: "300px",
      padding: "10px",
    };
  }

  async function deleteTemplateGroup() {
    const tg = currentTemplateGroup;
    showConfirm(
      "Are you sure you want to delete this template group?",
      async () => {
        await transactionService.deleteTemplateGroup(tg.id);
        await props.refreshTemplateGroups();
      }
    );
  }

  function getAccountCurrency(id) {
    const account = global.accounts.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  function areTransactionsValid() {
    let valid = true;
    currentTemplateGroup.template_group.forEach((t) => {
      if (t.type == 1) {
        const acc = props.accounts.filter((a) => a.id == t.account)[0];
        const amount = acc.amount;
        if (amount < t.amount) {
          showToast(
            `You only have ${acc.amount} ${helper.getCurrency(
              getAccountCurrency(acc.id)
            )} in ${acc.name}. You cannot spend ${
              t.amount
            } ${helper.getCurrency(getAccountCurrency(acc.id))}.`,
            "error"
          );
          valid = false;
          return;
        }
      }
      if (t.type == 2) {
        const acc = props.accounts.filter((a) => a.id == t.from_account)[0];
        const amount = acc.amount;
        if (amount < t.amount) {
          showToast(
            `You only have ${acc.amount} ${helper.getCurrency(
              getAccountCurrency(acc.id)
            )} in ${acc.name}. You cannot transfer ${
              t.amount
            } ${helper.getCurrency(getAccountCurrency(acc.id))}.`,
            "error"
          );
          valid = false;
          return;
        }
      }
    });

    return valid;
  }

  async function triggerTemplate() {
    // Check if any of the accounts is deleted
    let hasDeletedAccounts = false;
    currentTemplateGroup.template_group.forEach((t) => {
      if (t.account) {
        const acc = global.accounts.filter((a) => a.id === t.account)[0];
        if (acc.deleted) {
          showToast(
            `Account ${acc.name} is deleted. You cannot use this template.`,
            "error"
          );
          hasDeletedAccounts = true;
          return;
        }
      } else {
        const from = global.accounts.filter((a) => a.id === t.from_account)[0];
        const to = global.accounts.filter((a) => a.id === t.to_account)[0];
        if (from.deleted || to.deleted) {
          showToast(
            `Either ${from.name} or ${to.name} is deleted. You cannot use this template.`,
            "error"
          );
          hasDeletedAccounts = true;
          return;
        }
      }
    });
    if (hasDeletedAccounts) {
      return;
    }

    // Check if there are transactions registered in this template group.
    if (currentTemplateGroup.template_group.length == 0) {
      showToast("This template has not transactions.", "error");
      return;
    }
    // Check if user has enough funds first!
    if (!areTransactionsValid()) {
      return;
    }

    currentTemplateGroup.template_group.forEach(async (t) => {
      if (t.type == 0) {
        const payload = {
          amount: t.amount,
          category: t.category,
          date: new Date().toISOString().slice(0, 10),
          description: t.description,
          type: t.type,
          to_account: t.account,
          tags: t.tags,
        };
        await transactionService.addIncome(payload);
      }
      if (t.type == 1) {
        const payload = {
          amount: t.amount,
          category: t.category,
          date: new Date().toISOString().slice(0, 10),
          description: t.description,
          type: t.type,
          tags: t.tags,
          from_account: t.account,
        };

        await transactionService.addExpense(payload);
      }
      if (t.type == 2) {
        // Convert from_amount to to_amount
        t["from_amount"] = t["amount"];
        const from_currency = getAccountCurrency(parseInt(t["from_account"]));
        const to_currency = getAccountCurrency(parseInt(t["to_account"]));
        if (from_currency !== to_currency) {
          t["to_amount"] = await currencyService.convert(
            from_currency,
            to_currency,
            t["from_amount"]
          );
        } else {
          t["to_amount"] = t["from_amount"];
        }

        const payload = {
          from_amount: t.from_amount,
          to_amount: t.to_amount,
          date: new Date().toISOString().slice(0, 10),
          description: t.description,
          from_account: t.from_account,
          to_account: t.to_account,
          tags: t.tags,
          type: t.type,
        };
        await transactionService.addTransfer(payload);
      }
    });

    showToast("Transactions Added", "success");
    await global.updateTransactions();
  }

  return (
    <div className={"template-wrapper__template-groups"}>
      <div className={"header"}>
        <label>Name</label>
      </div>
      <div className={"template-groups"}>
        {props.templateGroups?.map((t) => (
          <div
            key={t.id}
            onMouseEnter={() => setCurrentTemplateGroup(t)}
            onMouseLeave={() => setCurrentTemplateGroup(false)}
            className={"template-group-item"}
            id={`template-group-item-${t.id}`}
          >
            <div className={"template-group-item__main"}>
              <label>{t.name}</label>
              <div className={"buttons"}>
                <button onClick={triggerTemplate} className={"trigger-button"}>
                  ▷
                </button>
                <button
                  onClick={deleteTemplateGroup}
                  className={"delete-button"}
                >
                  x
                </button>
              </div>
            </div>
            <label className={"template-group-item__created_on"}>
              Created on: {t.created_on.slice(0, 10)}
            </label>
          </div>
        ))}
      </div>
      {currentTemplateGroup && (
        <div
          style={currentTemplateGroupStyle()}
          className={"current-template-group"}
          id={"current-template-group"}
        >
          {currentTemplateGroup.template_group.length == 0 ? (
            <label>No transactions in this template group.</label>
          ) : (
            <>
              {currentTemplateGroup.template_group.map((i) => (
                <TemplateItem
                  key={i.id}
                  i={i}
                  accounts={props.accounts}
                  incomeCategories={props.incomeCategories}
                  expenseCategories={props.expenseCategories}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TemplateGroups;
