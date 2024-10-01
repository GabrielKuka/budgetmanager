export const helper = {
  showOrMask: (priv_mode, value) => {
    return priv_mode ? "****" : value;
  },
  getAccountName: (accounts, id) => {
    const account = accounts?.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].name;
    }
    return "Not found";
  },
  accountLabelStyle: (accounts, id) => {
    const account = accounts?.filter((a) => a.id === id)[0];
    if (account.deleted) {
      return { color: "gray", fontStyle: "italic" };
    }
    return null;
  },
  getCurrency: (currency) => {
    switch (currency) {
      case "EUR":
        return "€";
      case "USD":
        return "$";
      case "GBP":
        return "£";
      case "BGN":
        return "лв";
      default:
        return currency;
    }
  },
  formatNumber: (number, decimal = 2) => {
    const formatter = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: decimal,
    });
    return formatter.format(number);
  },
};
