import React, { useState, useEffect } from "react";
import { Formik, Form, Field } from "formik";
import "./templates.scss";
import transactionService from "../services/transactionService";
import axios from "axios";

const Template = () => {
    const types = ["Income", "Expense", "Transfer"];
    const [accounts, setAccounts] = useState([]);
    const [transfers, setTransfers] = useState([]);

    const [incomeCategories, setIncomeCategories] = useState([]);
    const [expenseCategories, setExpenseCategories] = useState([]);

    useEffect(() => {
        getAccounts();
        getTransfers();
        getIncomeCategories();
        getExpenseCategories();
    }, []);

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

    async function addTemplate(payload) {
        const url = "http://localhost:8000/templates/add-template";

        const token = JSON.parse(localStorage.getItem("authToken"));
        const config = {
            headers: {
                Authorization: token,
            },
        };

        const response = await axios.post(url, payload, config);
        console.log(response.data);
    }

    return (
        <div className={"add-template-wrapper"}>
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
                }}
                onSubmit={async (values, { setSubmitting, resetForm }) => {
                    console.log(values);
                    await addTemplate(values);
                    setSubmitting(false);
                    resetForm();
                }}
            >
                {({ values }) => (
                    <Form className={"form"}>
                        <label>Add Template</label>
                        <Field
                            id='date'
                            name='date'
                            placeholder='Enter date'
                        />
                        <Field as='select' name='type' id='type'>
                            <option value='' disabled hidden>
                                Select type
                            </option>
                            {types?.map((t) => (
                                <option
                                    key={types.indexOf(t)}
                                    value={types.indexOf(t)}
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
                                    {accounts?.map((a) => (
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
                                    {incomeCategories?.map((c) => (
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
                                    {accounts?.map((a) => (
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
                                    {expenseCategories?.map((c) => (
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
                                    {accounts &&
                                        accounts.map((a) => (
                                            <option key={a.id} value={a.id}>
                                                {a.name}{" "}
                                                {parseFloat(a.amount).toFixed(
                                                    2
                                                )}{" "}
                                                €
                                            </option>
                                        ))}
                                </Field>
                                <Field as='select' name='to_account'>
                                    <option value='' disabled hidden>
                                        To account
                                    </option>
                                    {accounts &&
                                        accounts.map((a) => (
                                            <option key={a.id} value={a.id}>
                                                {a.name}{" "}
                                                {parseFloat(a.amount).toFixed(
                                                    2
                                                )}{" "}
                                                €
                                            </option>
                                        ))}
                                </Field>
                            </>
                        )}
                        <Field name='amount' placeholder='Enter amount' />
                        <Field
                            type='text'
                            name='description'
                            placeholder='Enter description'
                        />
                        <button type='submit'>Submit</button>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

export default Template;
