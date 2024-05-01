import React from "react";
import { Formik, Form, Field } from "formik";
import { useGlobalContext } from "../../context/GlobalContext";
import { Navigate, Link } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import "./login.scss";

const Login = () => {
  const global = useGlobalContext();
  const showToast = useToast();

  if (global.authToken) {
    return <Navigate push to="/dashboard" />;
  }

  return (
    <div className={"login-wrapper"}>
      <Formik
        initialValues={{ email: "", password: "" }}
        onSubmit={async (values, { setSubmitting, resetForm }) => {
          const payload = { email: values.email, password: values.password };
          resetForm();
          setSubmitting(false);
          try {
            await global.loginUser(payload);
          } catch (error) {
            showToast(error.message, "error");
          }
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
            <button type="submit" id="submit-button">
              {props.isSubmitting ? "Logging in.." : "Log in"}
            </button>
            <Link to="/register" id={"register-link"}>
              New? Register an account here.
            </Link>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default Login;
