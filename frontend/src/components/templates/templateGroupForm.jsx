import React from "react";
import transactionService from "../../services/transactionService/transactionService";
import { Formik, Form, Field } from "formik";
import "./templates.scss";
import { validationSchemas } from "../../validationSchemas";

const TemplateGroupForm = (props) => {
  return (
    <Formik
      validateOnBlur={false}
      validateOnChange={false}
      validationSchema={validationSchemas.templateGroupFormSchema}
      onSubmit={(values, { resetForm, setSubmitting, validateForm }) => {
        validateForm().then(async () => {
          await transactionService.addTemplateGroup(values);
          await props.refreshTemplateGroups();
          setSubmitting(false);
          resetForm();
        });
      }}
      initialValues={{
        name: "",
      }}
    >
      {({ errors, touched }) => (
        <Form className={"form"}>
          <label>Add Template Group</label>
          <Field name="name" placeholder="Enter name.." />
          <button type="submit">Add Template Group</button>
          {errors.name && touched.name ? <span>{errors.name}</span> : null}
        </Form>
      )}
    </Formik>
  );
};

export default TemplateGroupForm;
