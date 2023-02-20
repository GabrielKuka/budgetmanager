import React from "react";
import { Formik, Form, Field } from "formik";
import { useGlobalContext } from "../../context/GlobalContext";
import { Navigate, Link } from "react-router-dom";

const Login = () => {
  const global = useGlobalContext();

  if (global.authToken) {
    return <Navigate push to="/dashboard" />;
  }

  return (
    <div>
      <h2>Login</h2>
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
          <Form>
            <Field type="text" name="email" placeholder="Email" />
            <br />
            <Field type="password" name="password" placeholder="Password" />
            <br />
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
