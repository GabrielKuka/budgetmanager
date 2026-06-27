import axios from "axios";
import { BASE_URL, BACKEND_PORT } from "../config";

const ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/currencies`;
const VALID_CURRENCIES = new Set(["EUR", "USD", "ALL", "BGN", "GBP"]);

function normalizeCurrency(currency) {
  if (typeof currency !== "string") {
    return null;
  }

  const normalized = currency.trim().toUpperCase();
  return VALID_CURRENCIES.has(normalized) ? normalized : null;
}

async function convert(from, to, amount) {
  const parsedAmount = parseFloat(amount || 0);
  const fromCurrency = normalizeCurrency(from);
  const toCurrency = normalizeCurrency(to);

  if (!fromCurrency || !toCurrency) {
    return parsedAmount;
  }

  if (fromCurrency === toCurrency) {
    return parsedAmount;
  }

  const response = await axios.get(
    `${ENDPOINT}/convert/${fromCurrency}/${toCurrency}/${parsedAmount}`
  );
  return parseFloat(response.data.conversion_result);
}

const currencyService = {
  convert,
};

export default currencyService;
