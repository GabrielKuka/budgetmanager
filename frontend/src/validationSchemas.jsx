import * as Yup from "yup";

export const validationSchemas = {
  accountsFormSchema: Yup.object().shape({
    name: Yup.string().required(),
    amount: Yup.number()
      .typeError("Amount must be a number")
      .min(0, "Amount must be >= 0.")
      .positive("Amount must be positive."),
  }),
  currency: Yup.string()
    .required()
    .oneOf(["EUR", "USD", "GBP", "ALL", "BGN"], "Invalid currency."),
  type: Yup.string().required("Account type is required."),
};
