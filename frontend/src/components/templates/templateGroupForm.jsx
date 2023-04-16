import React from "react";
import transactionService from "../../services/transactionService";
import { Formik, Form, Field } from "formik";
import "./templates.scss";

const TemplateGroupForm = (props) => {
    return (
        <Formik
            onSubmit={async (values, { resetForm, setSubmitting }) => {
                await transactionService.addTemplateGroup(values);
                await props.refreshTemplateGroups();
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

export default TemplateGroupForm;
