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

    const [templateList, setTemplateList] = useState([]);

    useEffect(() => {
        getAccounts();
        getTransfers();
        getIncomeCategories();
        getExpenseCategories();
        getTemplateGroups();
        getTemplates();
    }, []);

    async function getTemplates() {
        const response = await transactionService.getTemplates();
        setTemplateList(response);
    }

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
            {templateList?.length > 0 && <TemplateList />}
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

const TemplateList = () => {
    return (
        <div className={"template-wrapper__template_list"}>
            <label>Template List</label>
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
