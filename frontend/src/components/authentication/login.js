import React from "react";
import { Formik, Form, Field } from "formik";
import { useGlobalContext } from "../../context/GlobalContext";
import { Navigate, Link } from "react-router-dom";
import "./login.scss";

const Login = () => {
  const global = useGlobalContext();

  if (global.authToken) {
    return <Navigate push to="/dashboard" />;
  }

  return (
    <div className={"login-wrapper"}>
      <Formik
        initialValues={{ email: "", password: "" }}
        onSubmit={(values, { setSubmitting, resetForm }) => {
          const payload = { email: values.email, password: values.password };
          resetForm();
          setSubmitting(false);
          global.loginUser(payload);
        }}
      >
        {(props) => (
          <Form className={"login-wrapper__form"}>
            <label>Login</label>
            <Field
              type="text"
              name="email"
              className={"field_email"}
              placeholder="Email"
            />
            <Field
              type="password"
              name="password"
              className={"field_password"}
              placeholder="Password"
            />
            <button type="submit">
              {props.isSubmitting ? "Logging in.." : "Log in"}
            </button>
            <Link to="/register">Register</Link>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default Login;
