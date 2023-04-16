import React, { useState } from "react";
import TemplateItem from "./templateItem";
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
