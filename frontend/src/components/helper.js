export const helper = {
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
