import React from "react";
import "./templates.scss";
import { Formik, Form, Field } from "formik";
import transactionService from "../../services/transactionService/transactionService";

const TemplateForm = (props) => {
    return (
        <Formik
            initialValues={{
                amount: "",
                description: "",
                account: "",
                from_account: "",
                to_account: "",
                category: "",
                type: "",
                template_group: "",
            }}
            onSubmit={async (values, { setSubmitting, resetForm }) => {
                await transactionService.addTemplate(values);
                await props.refreshTemplateGroups();
                setSubmitting(false);
                resetForm();
            }}
        >
            {({ values }) => (
                <Form className={"form"}>
                    <label>Add Template</label>
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
                        <br />
                        <a
                            style={{ fontSize: "14px" }}
                            href='#'
                            onClick={() =>
                                props.setTemplateGroupForm(
                                    !props.templateGroupForm
                                )
                            }
                        >
                            Add Template Group
                        </a>
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

export default TemplateForm;
