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
          <Form>
            <Field type="text" name="name" placeholder="Full name" />
            <br />
            <Field type="email" name="email" placeholder="Email" />
            <br />
            <Field type="text" name="phone" placeholder="Phone number" />
            <br />
            <Field type="password" name="password" placeholder="Password" />
            <br />
            <button type="submit">Register</button>
            <Link to="/login">Log in</Link>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default Register;
