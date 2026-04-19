import * as Yup from "yup";

export const validationSchemas = {
  addTransactionSchema: Yup.object().shape({
    date: Yup.date().required("Date is required."),
    amount: Yup.number().when("transaction_type", {
      is: (type) => type === "0" || type === "1" || type === "2",
      then: (schema) =>
        schema
          .required("Amount is required.")
          .typeError("Amount must be a number.")
          .positive("Amount must be positive and greater than 0."),
      otherwise: (schema) => schema.notRequired(),
    }),
    description: Yup.string().max(
      100,
      "Description can be at most 100 charaters."
    ),
    category: Yup.string()
      .nullable()
      .when("transaction_type", {
        is: (type) => type === "0" || type === "1",
        then: (schema) =>
          schema.required("A category is required to be selected."),
        otherwise: (schema) => schema.notRequired(),
      }),
    from_cash_balance: Yup.string().when("transaction_type", {
      is: (type) => type === "1" || type === "2" || type === "3",
      then: (schema) => schema.required("Choose a source cash balance."),
      otherwise: (schema) => schema.notRequired(),
    }),
    to_cash_balance: Yup.string().when("transaction_type", {
      is: (type) => type === "0" || type === "2" || type === "4",
      then: (schema) => schema.required("Choose a destination cash balance."),
      otherwise: (schema) => schema.notRequired(),
    }),
    quantity: Yup.number().when("transaction_type", {
      is: (type) => type === "3" || type === "4",
      then: (schema) =>
        schema
          .required("Quantity is required.")
          .typeError("Quantity must be a number.")
          .positive("Quantity must be positive and greater than 0."),
      otherwise: (schema) => schema.notRequired(),
    }),
    price_per_unit: Yup.number().when("transaction_type", {
      is: (type) => type === "3" || type === "4",
      then: (schema) =>
        schema
          .required("Price is required.")
          .typeError("Price must be a number.")
          .positive("Price must be positive and greater than 0."),
      otherwise: (schema) => schema.notRequired(),
    }),
    security: Yup.string().when("transaction_type", {
      is: (type) => type === "3",
      then: (schema) => schema.required("Security is required for buy."),
      otherwise: (schema) => schema.notRequired(),
    }),
    holding: Yup.string().when("transaction_type", {
      is: (type) => type === "4",
      then: (schema) => schema.required("Holding is required for sell."),
      otherwise: (schema) => schema.notRequired(),
    }),
  }),
  accountsFormSchema: Yup.object().shape({
    name: Yup.string()
      .required("Name field is required.")
      .min(4, "Name must be minimum 4 characters long.")
      .max(30, "Name must be 30 characters long max."),
    cash_balances: Yup.array()
      .of(
        Yup.object().shape({
          currency: Yup.string()
            .required("Currency is required.")
            .matches(
              /^(USD|EUR|ALL|BGN|GBP)$/,
              "Only USD, EUR, ALL, BGN and GBP are allowed for now."
            ),
          amount: Yup.number()
            .required("Amount is required.")
            .typeError("Amount must be a number.")
            .min(0, "Amount must be >= 0.")
            .max(9999999, "Amount is too high."),
        })
      )
      .min(1, "At least one cash balance is required."),
    type: Yup.string().required("Account type is required."),
  }),
  incomeFormSchema: Yup.object().shape({
    date: Yup.date().required("Date is required."),
    amount: Yup.number()
      .required("Amount is required.")
      .typeError("Amount must be a number.")
      .positive("Amount must be positive and greater than 0."),
    description: Yup.string().max(
      50,
      "Description can be at most 50 charaters."
    ),
    to_account: Yup.string().required("Account is required."),
    category: Yup.string().required("Income category is required."),
  }),
  expenseFormSchema: Yup.object().shape({
    date: Yup.date().required("Date is required."),
    amount: Yup.number()
      .required("Amount is required.")
      .typeError("Amount must be a number.")
      .positive("Amount must be positive and greater than 0."),
    description: Yup.string().max(
      50,
      "Description can be at most 50 charaters."
    ),
    from_account: Yup.string().required("Account is required."),
    category: Yup.string().required("Expense category is required."),
  }),
  transferFormSchema: Yup.object().shape({
    date: Yup.date().required("Date is required."),
    from_amount: Yup.number()
      .required("Amount is required.")
      .typeError("Amount must be a number.")
      .positive("Amount must be positive and greater than 0."),
    from_account: Yup.string().required("Source Account is required."),
    to_account: Yup.string().required("Destination account is required."),
    description: Yup.string().max(
      50,
      "Description can be at most 50 charaters."
    ),
  }),
  registerFormSchema: Yup.object().shape({
    name: Yup.string().required("Full name is required."),
    email: Yup.string()
      .email("Not a valid email.")
      .required("Email is required."),
    phone: Yup.string()
      .typeError("Phone number is not valid.")
      .required("Phone number is required.")
      .min(10, "Phone number must be minimum 10 digits.")
      .matches(
        /^((\\+[1-9]{1,4}[ \\-]*)|(\\([0-9]{2,3}\\)[ \\-]*)|([0-9]{2,4})[ \\-]*)*?[0-9]{3,4}?[ \\-]*[0-9]{3,4}?$/,
        "Phone number is not valid."
      ),
    password: Yup.string()
      .required("Password is required.")
      .min(6, "Password must be at least 6 characters long."),
  }),
  loginFormSchema: Yup.object().shape({
    email: Yup.string()
      .email("Not a valid email.")
      .required("Email is required."),
    password: Yup.string().required("Password is required."),
  }),
};
