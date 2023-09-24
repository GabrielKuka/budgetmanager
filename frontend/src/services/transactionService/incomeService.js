import axios from "axios";
import { BASE_URL, BACKEND_PORT } from "../../config";

const ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/transactions`;

async function getAllIncomeCategories() {
  const response = await axios.get(`${ENDPOINT}/incomecategories`);

  return response.data;
}
async function getAllUserIncomes() {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };
  const response = await axios.get(`${ENDPOINT}/allincomes`, config);
  return response.data;
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

const incomeService = {
  addIncome,
  getAllIncomeCategories,
  getAllUserIncomes,
}

export default incomeService;