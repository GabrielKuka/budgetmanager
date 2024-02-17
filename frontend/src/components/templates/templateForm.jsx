import React, { useState } from "react";
import "./templates.scss";
import { Formik, Form, Field } from "formik";
import transactionService from "../../services/transactionService/transactionService";
import { useToast } from "../../context/ToastContext";
import { helper } from "../helper";
import currencyService from "../../services/currencyService";

const TemplateForm = (props) => {
  const showToast = useToast();
  const [tags, setTags] = useState([]);

  function getAccountCurrency(id) {
    const account = props.accounts.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  function addTag(e) {
    e.preventDefault();

    if (!e.target.previousElementSibling.value) {
      return;
    }
    if (!tags.includes(e.target.previousElementSibling.value)) {
      setTags([...tags, e.target.previousElementSibling.value]);
      const input = document.getElementById("add_tag_textfield");
      input.value = "";
      input.focus();
    }
  }

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
        values["tags"] = tags.map((t) => ({ name: t }));
        await transactionService.addTemplate(values);
        await props.refreshTemplateGroups();
        showToast(`Transaction Added in The Template`, "info");
        setSubmitting(false);
        setTags([]);
        resetForm();
      }}
    >
      {({ values }) => (
        <Form className={"form"}>
          <label>Add Template</label>
          <Field as="select" name="type" id="type">
            <option value="" disabled hidden>
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
              <Field as="select" name="account">
                <option value="" disabled hidden>
                  Select account
                </option>
                {props.accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {parseFloat(a.amount).toFixed(2)}{" "}
                    {helper.getCurrency(getAccountCurrency(a.id))}
                  </option>
                ))}
              </Field>
              <Field as="select" name="category">
                <option value="" disabled hidden>
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
              <Field as="select" name="account">
                <option value="" disabled hidden>
                  Select account
                </option>
                {props.accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {parseFloat(a.amount).toFixed(2)}{" "}
                    {helper.getCurrency(getAccountCurrency(a.id))}
                  </option>
                ))}
              </Field>
              <Field as="select" name="category">
                <option value="" disabled hidden>
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
              <Field as="select" name="from_account">
                <option value="" disabled hidden>
                  From account
                </option>
                {props.accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {parseFloat(a.amount).toFixed(2)}{" "}
                    {helper.getCurrency(getAccountCurrency(a.id))}
                  </option>
                ))}
              </Field>
              <Field as="select" name="to_account">
                <option value="" disabled hidden>
                  To account
                </option>
                {props.accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {parseFloat(a.amount).toFixed(2)}{" "}
                    {helper.getCurrency(getAccountCurrency(a.id))}
                  </option>
                ))}
              </Field>
            </>
          )}
          <Field name="amount" placeholder="Enter amount" />
          <div>
            <Field as="select" name="template_group" id="template_group">
              <option value="" disabled hidden>
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
              href="#"
              onClick={() =>
                props.setTemplateGroupForm(!props.templateGroupForm)
              }
            >
              Add Template Group
            </a>
          </div>
          <div className={"tags_container"}>
            <div className={"tags_container__input"}>
              <input
                type="text"
                name="tags"
                id="add_tag_textfield"
                placeholder="Enter tags"
              />
              <button
                type="button"
                className={"add-tag-button"}
                onClick={(e) => addTag(e)}
              >
                + Tag
              </button>
            </div>
            {tags && (
              <div className={"tags_container__shown-tags"}>
                {tags.map((t) => (
                  <span className={"tag"} key={t}>
                    {t}
                    <button
                      type="button"
                      className={"remove-tag-button"}
                      onClick={() => setTags(tags.filter((tag) => tag !== t))}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <Field
            type="text"
            name="description"
            placeholder="Enter description"
          />
          <button type="submit">Submit</button>
        </Form>
      )}
    </Formik>
  );
};

export default TemplateForm;
