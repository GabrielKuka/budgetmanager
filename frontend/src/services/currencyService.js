import axios from "axios";
import {
  BASE_URL,
  BACKEND_PORT,
  CURRENCY_API_KEY,
  CURRENCY_BASE_URL,
} from "../config";

const ENDPOINT = `${CURRENCY_BASE_URL}/latest.json?app_id=${CURRENCY_API_KEY}`;

async function convert(from, to, amount) {
  if (from === to) {
    return amount;
  }

  // Check if rates are stored in cookies
  const cachedRates = localStorage.getItem("rates");
  if (cachedRates) {
    const cachedRatesTime = localStorage.getItem("rates_time");
    const currentTime = new Date().getTime();

    if (currentTime - parseInt(cachedRatesTime) <= 5 * 60 * 60 * 1000) {
      const rates = JSON.parse(cachedRates);
      const fromUSDrate = rates[from];
      const toUSDamount = amount / fromUSDrate;
      const toAmount = toUSDamount * rates[to];

      return parseFloat(toAmount).toFixed(2);
    }
  }

  const response = await axios.get(`${ENDPOINT}`);
  const rates = response.data.rates;

  const fromUSDrate = rates[from];
  const toUSDamount = amount / fromUSDrate;
  const toAmount = toUSDamount * rates[to];

  localStorage.setItem(`rates`, JSON.stringify(rates));
  localStorage.setItem(`rates_time`, new Date().getTime());

  return parseFloat(toAmount).toFixed(2);
}

async function convertInvestments(currency) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.get(
    `${ENDPOINT}/convert_on_type/${currency}/1`,
    config
  );

  return response.data;
}

async function convertCash(currency) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.get(
    `${ENDPOINT}/convert_on_type/${currency}/2`,
    config
  );

  return response.data;
}

async function convertBankAssets(currency) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.get(
    `${ENDPOINT}/convert_on_type/${currency}/0`,
    config
  );

  return response.data;
}

const currencyService = {
  convert,
  convertInvestments,
  convertCash,
  convertBankAssets,
};

export default currencyService;
