import axios from "axios";
import { BASE_URL, BACKEND_PORT } from "../config";

const ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/transactions`;

async function search(query) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    params: {
      query: query,
    },
    headers: {
      Authorization: token,
    },
  };
  const response = await axios.get(`${ENDPOINT}/search`, config);

  let results = response.data;

  results.expenses = results.expenses.map((e) => ({
    ...e,
    id: `expense_${e.id}`,
  }));
  results.incomes = results.incomes.map((e) => ({
    ...e,
    id: `income_${e.id}`,
  }));
  results.transfers = results.transfers.map((e) => ({
    ...e,
    id: `transfer_${e.id}`,
  }));

  return results;
}

export default {
  search,
};
