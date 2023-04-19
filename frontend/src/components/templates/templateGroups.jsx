import React, { useState } from "react";
import TemplateItem from "./templateItem";
import transactionService from "../../services/transactionService/transactionService";
import "./templates.scss";
import { useToast } from "../../context/ToastContext";

const TemplateGroups = (props) => {
    const [currentTemplateGroup, setCurrentTemplateGroup] = useState(false);
    const showToast = useToast();

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
        const response = window.confirm(
            "Are you sure you want to delete this template group?"
        );
        if (response) {
            await transactionService.deleteTemplateGroup(tg.id);
            await props.refreshTemplateGroups();
        }
    }

    function areTransactionsValid() {
        let valid = true;
        currentTemplateGroup.template_group.forEach((t) => {
            if (t.type == 1) {
                const acc = props.accounts.filter((a) => a.id == t.account)[0];
                const amount = acc.amount;
                if (amount < t.amount) {
                    showToast(
                        `You only have ${acc.amount}€ in ${acc.name}. You cannot spend ${t.amount}€.`,
                        "error"
                    );
                    valid = false;
                    return;
                }
            }
            if (t.type == 2) {
                const acc = props.accounts.filter(
                    (a) => a.id == t.from_account
                )[0];
                const amount = acc.amount;
                if (amount < t.amount) {
                    showToast(
                        `You only have ${acc.amount}€ in ${acc.name}. You cannot transfer ${t.amount}€.`,
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
                    income_category: t.category,
                    date: new Date().toISOString().slice(0, 10),
                    description: t.description,
                    type: t.type,
                    account: t.account,
                };
                await transactionService.addIncome(payload);
            }
            if (t.type == 1) {
                const payload = {
                    amount: t.amount,
                    expense_category: t.category,
                    date: new Date().toISOString().slice(0, 10),
                    description: t.description,
                    type: t.type,
                    account: t.account,
                };

                await transactionService.addExpense(payload);
            }
            if (t.type == 2) {
                const payload = {
                    amount: t.amount,
                    date: new Date().toISOString().slice(0, 10),
                    description: t.description,
                    from_account: t.from_account,
                    to_account: t.to_account,
                    type: t.type,
                };
                await transactionService.addTransfer(payload);
            }
        });

        showToast("Transactions Added", "success");
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
                                <button
                                    onClick={triggerTemplate}
                                    className={"trigger-button"}
                                >
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
