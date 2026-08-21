import { useState } from "react";
import { Formik, Form } from "formik";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useGlobalContext } from "../../context/GlobalContext";
import { useToast } from "../../context/ToastContext";
import { validationSchemas } from "../../validationSchemas";
import { AuthLayout, PasswordField, SubmitButton, TextField } from "./auth";

const Register = () => {
  const global = useGlobalContext();
  const navigate = useNavigate();
  const showToast = useToast();
  const [showPassword, setShowPassword] = useState(false);

  if (global.authToken) {
    return <Navigate push to="/dashboard" />;
  }

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your account"
      description="Start with a clearer view of your money. It only takes a moment."
    >
      <Formik
        initialValues={{ name: "", email: "", phone: "", password: "" }}
        validateOnChange={false}
        validateOnBlur
        validationSchema={validationSchemas.registerFormSchema}
        onSubmit={async (values, { setStatus, setSubmitting, resetForm }) => {
          setStatus(null);
          try {
            const response = await global.registerUser(values);
            if (response.status !== 201) {
              throw new Error(
                "Unable to create your account. Please try again."
              );
            }
            resetForm();
            showToast("Account created. Please log in.", "success");
            navigate("/login");
          } catch (error) {
            const message =
              error.response?.data?.email?.[0] ||
              error.response?.data?.detail ||
              error.message ||
              "Unable to create your account. Please try again.";
            setStatus(message);
            showToast(message, "error");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({ errors, touched, isSubmitting, status }) => (
          <Form className="auth-form" noValidate>
            {status && (
              <p className="auth-form__error" role="alert">
                {status}
              </p>
            )}
            <TextField
              name="name"
              label="Full name"
              autoComplete="name"
              error={touched.name && errors.name}
            />
            <TextField
              name="email"
              label="Email address"
              type="email"
              autoComplete="email"
              error={touched.email && errors.email}
            />
            <TextField
              name="phone"
              label="Phone number"
              type="tel"
              autoComplete="tel"
              error={touched.phone && errors.phone}
            />
            <PasswordField
              showPassword={showPassword}
              onToggle={() => setShowPassword((current) => !current)}
              autoComplete="new-password"
              error={touched.password && errors.password}
            />
            <SubmitButton loading={isSubmitting}>Create account</SubmitButton>
            <p className="auth-form__switch">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </Form>
        )}
      </Formik>
    </AuthLayout>
  );
};

export default Register;
