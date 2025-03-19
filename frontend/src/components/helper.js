export const helper = {
  categoryIcon: (category) => {
    switch (category) {
      case 1:
        return "💵";
      case 2:
        return "📈";
      case 3:
        return "🔣";
      case 4:
        return "🎉";
      case 5:
        return "💸";
      case 6:
        return "💲";
      case 7:
        return "🔄";

      case 13:
        return "🏠";
      case 14:
        return "🔣";
      case 11:
        return "🍔";
      case 25:
        return "🥤";
      case 15:
        return "⚡";
      case 16:
        return "🚰";
      case 17:
        return "🌐";
      case 18:
        return "📞";
      case 19:
        return "💪";
      case 21:
        return "🚆";
      case 22:
        return "💰";
      case 24:
        return "🏨";
      case 26:
        return "💇";
      case 27:
        return "🧥";
      case 28:
        return "🧴";
      case 20:
        return "💡";
      default:
        return category;
    }
  },
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
  isRecent: (inputDatetime) => {
    const now = new Date();
    inputDatetime = new Date(inputDatetime);
    const diffInMs = now.getTime() - inputDatetime.getTime();
    const diffInHrs = diffInMs / (1000 * 60 * 60);
    return diffInHrs <= 5;
  },
  formatDatetime: (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("sv-SE").replace("T", " ");
  },
  amountLabelColor: (itemType) => {
    // 0 for income, 1 for expense and 2 for transfers
    switch (itemType) {
      case 0:
        return "green";
      case 1:
        return "red";
      case 2:
        return "cadetblue";
      default:
        return "";
    }
  },
};
