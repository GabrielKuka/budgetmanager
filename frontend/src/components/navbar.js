import React, { useState } from "react";
import { useGlobalContext } from "../context/GlobalContext";
import { useNavigate } from "react-router-dom";
import "./navbar.scss";
import { Formik, Form, Field } from "formik";
import convert from "../services/currencyService";

const Navbar = () => {
  const global = useGlobalContext();
  return (
    <div className={"navbar-wrapper"}>
      {global.authToken ? <LoggedInNavbar /> : <LoggedOutNavbar />}
    </div>
  );
};

export default Navbar;

const LoggedInNavbar = () => {
  const global = useGlobalContext();
  const navigate = useNavigate();
  const handleLogout = () => {
    global.logoutUser();
  };

  return (
    <div className={"navbar-wrapper__loggedin"}>
      <button onClick={() => navigate("/dashboard")}>Dashboard</button>
      <button onClick={() => navigate("/accounts")}>Accounts</button>
      <button onClick={() => navigate("/profile")}>Profile</button>
      <button onClick={handleLogout}>Log out</button>
      <CurrencyConverter />
    </div>
  );
};

const LoggedOutNavbar = () => {
  return <div>Logged out</div>;
};

const CurrencyConverter = () => {
  const currencies = ["BGN", "EUR", "USD", "GBP"];
  const [result, setResult] = useState(null);
  return (
    <>
      <Formik
        initialValues={{
          amount: 0,
          from_currency: "BGN",
          to_currency: "EUR",
        }}
        onSubmit={async (values) => {
          const from = values.from_currency;
          const to = values.to_currency;
          const amount = values.amount;

          const result = await convert(from, to, amount);
          setResult(result.data.result);
        }}
      >
        {() => (
          <Form className={"currency-converter-form"}>
            <Field type="text" name="amount" placeholder="Enter amount value" />
            <Field as="select" name="from_currency">
              {currencies &&
                currencies.map((c) => (
                  <option value={c} key={c}>
                    {c}
                  </option>
                ))}
            </Field>
            <label>--&gt;</label>
            <Field as="select" name="to_currency">
              {currencies &&
                currencies.map((c) => (
                  <option value={c} key={c}>
                    {c}
                  </option>
                ))}
            </Field>
            <button type="submit">Convert</button>
            <label>{result}</label>
          </Form>
        )}
      </Formik>
    </>
  );
};
