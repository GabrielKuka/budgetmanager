import { useState, useEffect, useRef, React } from "react";
import { Formik, Form, Field } from "formik";
import { useGlobalContext } from "../../context/GlobalContext";
import { Navigate, Link } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import "./login.scss";
import { validationSchemas } from "../../validationSchemas";

const Login = () => {
  const global = useGlobalContext();
  const showToast = useToast();

  if (global.authToken) {
    return <Navigate push to="/dashboard" />;
  }

  return (
    <div className={"login-wrapper"}>
      <AutoScrollContainer />
      <Formik
        validateOnBlur={false}
        validateOnChange={false}
        validationSchema={validationSchemas.loginFormSchema}
        initialValues={{ email: "", password: "" }}
        onSubmit={(values, { setSubmitting, resetForm, validateForm }) => {
          validateForm().then(async () => {
            const payload = { email: values.email, password: values.password };
            resetForm();
            setSubmitting(false);
            try {
              await global.loginUser(payload);
            } catch (error) {
              showToast(error.message, "error");
            }
          });
        }}
      >
        {({ errors, touched, isSubmitting }) => (
          <div id="login-wrapper">
            <Form className={"form"}>
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
                {isSubmitting ? "Logging in.." : "Log in"}
              </button>
              {errors.email && touched.email ? (
                <span>{errors.email}</span>
              ) : null}
              {errors.password && touched.password ? (
                <span>{errors.password}</span>
              ) : null}
              <Link to="/register" id={"register-link"}>
                New? Register an account here.
              </Link>
            </Form>
          </div>
        )}
      </Formik>
    </div>
  );
};

const AutoScrollContainer = () => {
  const [index, setIndex] = useState(0);
  const sentencesRef = useRef(null);
  const sentences = [
    "Manage your incomes, expenses and bank transfers.",
    "Experience a different way of looking at your finances.",
    "Bring your spending under control.",
    "Explore investment opportunities.",
    "Visualize your net worth!",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prevIndex) => {
        if (prevIndex === sentences.length - 1) return 0;
        return prevIndex + 1;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [sentences.length]);

  useEffect(() => {
    if (sentencesRef.current) {
      sentencesRef.current.style.transform = `translateY(-${index * 600}px)`;
    }
  }, [index]);

  return (
    <div id="left-side-wrapper">
      <div className="sentences" ref={sentencesRef}>
        {sentences.map((text, i) => (
          <div className="sentence" key={i}>
            {text}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Login;
