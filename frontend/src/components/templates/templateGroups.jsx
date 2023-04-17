import React, { useState } from "react";
import TemplateItem from "./templateItem";
import transactionService from "../../services/transactionService/transactionService";
import "./templates.scss";

const TemplateGroups = (props) => {
    const [currentTemplateGroup, setCurrentTemplateGroup] = useState(false);

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

    async function triggerTemplate() {
        // Check if user has enough funds first!

        currentTemplateGroup.template_group.forEach(async (t) => {
            if (t.type == 0) {
                const payload = {
                    amount: t.amount,
                    income_category: t.category,
                    date: t.date,
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
                    date: t.date,
                    description: t.description,
                    type: t.type,
                    account: t.account,
                };

                await transactionService.addExpense(payload);
            }
            if (t.type == 2) {
                const payload = {
                    amount: t.amount,
                    date: t.date,
                    description: t.description,
                    from_account: t.from_account,
                    to_account: t.to_account,
                    type: t.type,
                };
                await transactionService.addTransfer(payload);
            }
        });

        alert("Transactions added.");
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
                        <label>{t.name}</label>
                        <div className={"template-group-item__buttons"}>
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
