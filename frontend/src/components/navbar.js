import React, { useState, useEffect } from "react";
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

  const buttons = ["dashboard", "accounts", "profile", "templates"];

  useEffect(() => {
    let location = window.location.pathname.replace("/", "");
    const activeButton = location
      ? document.getElementById(location)
      : document.getElementById("dashboard");
    if (activeButton) {
      activeButton.style.fontWeight = "bold";
    }
  }, []);

  function handlePage(e) {
    const selected = e.target.innerText.toLowerCase();
    navigate(selected);

    buttons.forEach((button) => {
      document.getElementById(button).style.fontWeight =
        selected == button ? "bold" : "normal";
    });
  }

  return (
    <div className={"navbar-wrapper__loggedin"}>
      <button id="dashboard" onClick={(e) => handlePage(e)}>
        Dashboard
      </button>
      <button id="accounts" onClick={(e) => handlePage(e)}>
        Accounts
      </button>
      <button id="profile" onClick={(e) => handlePage(e)}>
        Profile
      </button>
      <button id="templates" onClick={(e) => handlePage(e)}>
        Templates
      </button>
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
          setResult(result);
        }}
      >
        {() => (
          <Form className={"currency-converter-form"}>
            <Field
              type="text"
              name="amount"
              id="amount_field"
              placeholder="Enter amount value"
            />
            <Field as="select" name="from_currency">
              {currencies?.map((c) => (
                  <option value={c} key={c}>
                    {c}
                  </option>
                ))}
            </Field>
            <label>--&gt;</label>
            <Field as="select" name="to_currency">
              {currencies?.map((c) => (
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
