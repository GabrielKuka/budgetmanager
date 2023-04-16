import React, { useState, useEffect } from "react";
import { Formik, Form, Field } from "formik";
import "./templates.scss";
import transactionService from "../services/transactionService";
import axios from "axios";

const Template = () => {
    const types = ["Income", "Expense", "Transfer"];
    const [accounts, setAccounts] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const [templateGroups, setTemplateGroups] = useState([]);

    const [incomeCategories, setIncomeCategories] = useState([]);
    const [expenseCategories, setExpenseCategories] = useState([]);

    useEffect(() => {
        getAccounts();
        getTransfers();
        getIncomeCategories();
        getExpenseCategories();
        getTemplateGroups();
    }, []);

    async function getTemplateGroups() {
        const response = await transactionService.getTemplateGroups();
        setTemplateGroups(response);
    }

    async function getTransfers() {
        const response = await transactionService.getAllUserTransfers();
        setTransfers(response);
    }

    async function getAccounts() {
        const response = await transactionService.getAllUserAccounts();
        setAccounts(response);
    }

    async function getIncomeCategories() {
        const response = await transactionService.getAllIncomeCategories();
        setIncomeCategories(response);
    }

    async function getExpenseCategories() {
        const response = await transactionService.getAllExpenseCategories();
        setExpenseCategories(response);
    }

    return (
        <div className={"template-wrapper"}>
            <Sidebar
                types={types}
                accounts={accounts}
                incomeCategories={incomeCategories}
                expenseCategories={expenseCategories}
                templateGroups={templateGroups}
            />
            {templateGroups?.length > 0 && (
                <TemplateGroups
                    templateGroups={templateGroups}
                    accounts={accounts}
                    incomeCategories={incomeCategories}
                    expenseCategories={expenseCategories}
                />
            )}
        </div>
    );
};

const Sidebar = (props) => {
    const [templateGroupForm, setTemplateGroupForm] = useState(false);
    return (
        <div className={"template-wrapper__sidebar"}>
            <div className={"add-template"}>
                <TemplateForm
                    types={props.types}
                    accounts={props.accounts}
                    incomeCategories={props.incomeCategories}
                    expenseCategories={props.expenseCategories}
                    templateGroups={props.templateGroups}
                    templateGroupForm={templateGroupForm}
                    setTemplateGroupForm={setTemplateGroupForm}
                />
            </div>
            {templateGroupForm && (
                <div className={"add-template_group"}>
                    <TemplateGroupForm />
                </div>
            )}
        </div>
    );
};

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
                    {currentTemplateGroup.template_group.map((i) => (
                        <TemplateItem
                            key={i.id}
                            i={i}
                            accounts={props.accounts}
                            incomeCategories={props.incomeCategories}
                            expenseCategories={props.expenseCategories}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

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
                    Transfer <b>{amount}€</b> from{" "}
                    <i>{getAccount(from_account)}</i> to{" "}
                    <i>{getAccount(to_account)}</i>
                </label>
            )}
        </div>
    );
};

const TemplateForm = (props) => {
    return (
        <Formik
            initialValues={{
                amount: "",
                description: "",
                date: new Date().toISOString().slice(0, 10),
                account: "",
                from_account: "",
                to_account: "",
                category: "",
                type: "",
                template_group: "",
            }}
            onSubmit={async (values, { setSubmitting, resetForm }) => {
                await transactionService.addTemplate(values);
                setSubmitting(false);
                resetForm();
            }}
        >
            {({ values }) => (
                <Form className={"form"}>
                    <label>Add Template</label>
                    <Field id='date' name='date' placeholder='Enter date' />
                    <Field as='select' name='type' id='type'>
                        <option value='' disabled hidden>
                            Select transaction type
                        </option>
                        {props.types?.map((t) => (
                            <option
                                key={props.types.indexOf(t)}
                                value={props.types.indexOf(t)}
                            >
                                {t}
                            </option>
                        ))}
                    </Field>
                    {parseInt(values.type) === 0 && (
                        <>
                            <Field as='select' name='account'>
                                <option value='' disabled hidden>
                                    Select account
                                </option>
                                {props.accounts?.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}{" "}
                                        {parseFloat(a.amount).toFixed(2)} €
                                    </option>
                                ))}
                            </Field>
                            <Field as='select' name='category'>
                                <option value='' disabled hidden>
                                    Income category
                                </option>
                                {props.incomeCategories?.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.category_type}
                                    </option>
                                ))}
                            </Field>
                        </>
                    )}

                    {parseInt(values.type) === 1 && (
                        <>
                            <Field as='select' name='account'>
                                <option value='' disabled hidden>
                                    Select account
                                </option>
                                {props.accounts?.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}{" "}
                                        {parseFloat(a.amount).toFixed(2)} €
                                    </option>
                                ))}
                            </Field>
                            <Field as='select' name='category'>
                                <option value='' disabled hidden>
                                    Expense category
                                </option>
                                {props.expenseCategories?.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.category_type}
                                    </option>
                                ))}
                            </Field>
                        </>
                    )}
                    {parseInt(values.type) === 2 && (
                        <>
                            <Field as='select' name='from_account'>
                                <option value='' disabled hidden>
                                    From account
                                </option>
                                {props.accounts?.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}{" "}
                                        {parseFloat(a.amount).toFixed(2)} €
                                    </option>
                                ))}
                            </Field>
                            <Field as='select' name='to_account'>
                                <option value='' disabled hidden>
                                    To account
                                </option>
                                {props.accounts?.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}{" "}
                                        {parseFloat(a.amount).toFixed(2)} €
                                    </option>
                                ))}
                            </Field>
                        </>
                    )}
                    <Field name='amount' placeholder='Enter amount' />
                    <div>
                        <Field
                            as='select'
                            name='template_group'
                            id='template_group'
                        >
                            <option value='' disabled hidden>
                                Select Template Group
                            </option>
                            {props.templateGroups?.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </Field>
                        <button
                            type='button'
                            onClick={() =>
                                props.setTemplateGroupForm(
                                    !props.templateGroupForm
                                )
                            }
                        >
                            Add Template Group
                        </button>
                    </div>
                    <Field
                        type='text'
                        name='description'
                        placeholder='Enter description'
                    />
                    <button type='submit'>Submit</button>
                </Form>
            )}
        </Formik>
    );
};

const TemplateGroupForm = () => {
    return (
        <Formik
            onSubmit={async (values, { resetForm, setSubmitting }) => {
                const response = await transactionService.addTemplateGroup(
                    values
                );
                setSubmitting(false);
                resetForm();
            }}
            initialValues={{
                name: "",
            }}
        >
            {() => (
                <Form className={"form"}>
                    <label>Add Template Group</label>
                    <Field name='name' placeholder='Enter name..' />
                    <button type='submit'>Add Template Group</button>
                </Form>
            )}
        </Formik>
    );
};

export default Template;
