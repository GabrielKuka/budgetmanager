import { useState } from "react";
import { Formik, Form, Field } from "formik";
import currencyService from "../../services/currencyService";
import "./conversiontool.scss";

const ConversionTool = ({ closePopup }) => {
  const currencies = ["BGN", "EUR", "USD", "GBP"];
  const [result, setResult] = useState(null);

  return (
    <>
      <div className={"overlay"}></div>
      <div className={"conversion-popup-wrapper"}>
        <div className={"title-bar"}>
          <span className={"title"}>Currency Converter Tool</span>
          <button className={"close-popup"} onClick={closePopup}>
            X
          </button>
        </div>
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

            const result = await currencyService.convert(from, to, amount);
            setResult(result);
          }}
        >
          {() => (
            <Form className={"currency-converter-form"}>
              <div>
                <label>From: </label>
                <Field
                  type="text"
                  name="amount"
                  className={"textfield"}
                  id="amount_field"
                  placeholder="Enter amount value"
                />
                <Field
                  as="select"
                  className={"select-currency"}
                  name="from_currency"
                >
                  {currencies?.map((c) => (
                    <option value={c} key={c}>
                      {c}
                    </option>
                  ))}
                </Field>
              </div>
              <div>
                <label>To: </label>
                <Field
                  as="select"
                  className={"select-currency to-currency"}
                  name="to_currency"
                >
                  {currencies?.map((c) => (
                    <option value={c} key={c}>
                      {c}
                    </option>
                  ))}
                </Field>
                <label>{result}</label>
              </div>
              <div className={"separator"}></div>
              <button type="submit" className={"submit-button"}>
                Convert
              </button>
            </Form>
          )}
        </Formik>
      </div>
    </>
  );
};

export default ConversionTool;
