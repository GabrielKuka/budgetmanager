import axios from "axios";
import { BASE_URL, BACKEND_PORT } from "../../config";

const ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/transactions`;

async function getAllIncomeCategories() {
  const response = await axios.get(`${ENDPOINT}/incomecategories`);

  return response.data;
}
async function getUserIncomes(dateRange, includeDrafts = true) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const fmt = (d) =>
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0");

  const config = {
    params: {
      from_date: fmt(dateRange.from),
      to_date: fmt(dateRange.to),
      include_drafts: includeDrafts ? "true" : "false",
    },
    headers: {
      Authorization: token,
    },
  };
  const response = await axios.get(`${ENDPOINT}/get_incomes`, config);

  if (response.status === 200) {
    return response.data;
  } else {
    alert("Error fetching transactions.");
  }
}

async function addIncome(payload) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.post(`${ENDPOINT}/add`, payload, config);
  return response.data;
}

async function deleteIncome(payload) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.post(`${ENDPOINT}/delete`, payload, config);
  return response.data;
}

const incomeService = {
  addIncome,
  deleteIncome,
  getAllIncomeCategories,
  getUserIncomes,
};

export default incomeService;
