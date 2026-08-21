import { useState } from "react";
import { Formik, Form } from "formik";
import { Navigate, Link } from "react-router-dom";
import { useGlobalContext } from "../../context/GlobalContext";
import { useToast } from "../../context/ToastContext";
import { validationSchemas } from "../../validationSchemas";
import { AuthLayout, PasswordField, SubmitButton, TextField } from "./auth";

const Login = () => {
  const global = useGlobalContext();
  const showToast = useToast();
  const [showPassword, setShowPassword] = useState(false);

  if (global.authToken) {
    return <Navigate push to="/dashboard" />;
  }

  return (
    <AuthLayout
      eyebrow="Sign in"
      title="Welcome back"
      description="Pick up where you left off and keep your financial picture in focus."
    >
      <Formik
        initialValues={{ email: "", password: "" }}
        validateOnChange={false}
        validateOnBlur
        validationSchema={validationSchemas.loginFormSchema}
        onSubmit={async (values, { setStatus, setSubmitting }) => {
          setStatus(null);
          try {
            await global.loginUser({
              email: values.email,
              password: values.password,
            });
          } catch (error) {
            const message =
              error.message || "Unable to log in. Please try again.";
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
              name="email"
              label="Email address"
              type="email"
              autoComplete="email"
              error={touched.email && errors.email}
            />
            <PasswordField
              showPassword={showPassword}
              onToggle={() => setShowPassword((current) => !current)}
              autoComplete="current-password"
              error={touched.password && errors.password}
            />
            <SubmitButton loading={isSubmitting}>Log in</SubmitButton>
            <p className="auth-form__switch">
              New to BudgetManager?{" "}
              <Link to="/register">Create an account</Link>
            </p>
          </Form>
        )}
      </Formik>
    </AuthLayout>
  );
};

export default Login;
