import React from "react";
import { useGlobalContext } from "../../context/GlobalContext";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Formik, Form, Field } from "formik";
import "./register.scss";

const Register = () => {
  const global = useGlobalContext();
  const navigate = useNavigate();

  if (global.authToken) {
    return <Navigate push to="/dashboard" />;
  }

  return (
    <div className={"register-wrapper"}>
      <Formik
        initialValues={{
          name: "",
          phone: "",
          email: "",
          password: "",
        }}
        onSubmit={async (values, { setSubmitting, resetForm }) => {
          resetForm();
          setSubmitting(false);
          const response = await global.registerUser(values);

          if (response.status === 201) {
            navigate("/login");
          } else {
            alert("Something went wrong.");
          }
        }}
      >
        {({ props }) => (
          <Form className={"register-wrapper__form"}>
            <label>Register</label>
            <Field
              type="text"
              name="name"
              className={"field_name"}
              placeholder="Full name"
            />
            <Field
              type="email"
              name="email"
              className={"field_email"}
              placeholder="Email"
            />
            <Field
              type="text"
              name="phone"
              className={"field_phone"}
              placeholder="Phone number"
            />
            <Field
              type="password"
              name="password"
              className={"field_password"}
              placeholder="Password"
            />
            <button type="submit">Register</button>
            <Link to="/login">Log in</Link>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default Register;
