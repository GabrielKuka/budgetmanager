import * as Yup from "yup";

export const validationSchemas = {
  accountsFormSchema: Yup.object().shape({
    name: Yup.string()
      .required("Name field is required.")
      .min(4, "Name must be minimum 4 characters long.")
      .max(30, "Name must be 30 characters long max."),
    amount: Yup.number()
      .required("Amount is required.")
      .typeError("Amount must be a number.")
      .min(0, "Amount must be >= 0.")
      .max(9999999, "You're not that rich are you?")
      .positive("Amount must be positive."),
    currency: Yup.string()
      .required("Currency is required.")
      .matches(
        /^(USD|EUR|ALL|BGN|GBP)$/,
        "Only USD, EUR, ALL, BGN and GBP are allowed for now."
      ),
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
    account: Yup.string().required("Account is required."),
    income_category: Yup.string().required("Income category is required."),
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
    account: Yup.string().required("Account is required."),
    expense_category: Yup.string().required("Expense category is required."),
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
  templateFormSchema: Yup.object().shape({
    type: Yup.string().required("Transaction type is required."),
    category: Yup.string().required("Category is required."),
    amount: Yup.number()
      .required("Amount is required.")
      .typeError("Amount must be a number.")
      .positive("Amount must be positive and greater than 0."),
    description: Yup.string().max(
      50,
      "Description can be at most 50 charaters."
    ),
    template_group: Yup.string().required("Select a template group."),
  }),
  templateGroupFormSchema: Yup.object().shape({
    name: Yup.string().required("Template group name is required."),
  }),
};
