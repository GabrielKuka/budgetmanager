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
    if (account?.deleted) {
      return { color: "gray", fontStyle: "italic" };
    }
    return null;
  },
  getTransactionCurrency: (accounts, transaction, fallbackFn) => {
    if (!transaction) {
      return "Not Found";
    }

    let balanceId = null;
    if (
      transaction.transaction_type === "income" ||
      transaction.transaction_type === "sell"
    ) {
      balanceId = transaction.to_cash_balance;
    } else {
      balanceId = transaction.from_cash_balance;
    }

    if (balanceId) {
      for (const account of accounts || []) {
        const balance = (account.cash_balances || []).find(
          (item) => item.id === balanceId
        );
        if (balance) {
          return balance.currency?.code || account.currency;
        }
      }
    }

    const accountId =
      transaction.transaction_type === "income" ||
      transaction.transaction_type === "sell"
        ? transaction.to_account
        : transaction.from_account;

    return fallbackFn ? fallbackFn(accountId) : "Not Found";
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
  amountLabelColor: (transactionType) => {
    // 0 for income, 1 for expense and 2 for transfers
    switch (transactionType) {
      case "income":
        return "green";
      case "expense":
        return "red";
      case "transfer":
        return "cadetblue";
      case "buy":
        return "darkorange";
      case "sell":
        return "seagreen";
      default:
        return "";
    }
  },
};
