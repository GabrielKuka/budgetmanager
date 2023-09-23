import axios from "axios";

const BASE_URL = "http://localhost:8001/transactions";

async function getAllIncomeCategories() {
  const response = await axios.get(`${BASE_URL}/incomecategories`);

  return response.data;
}
async function getAllUserIncomes() {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };
  const response = await axios.get(`${BASE_URL}/allincomes`, config);
  return response.data;
}

async function addIncome(payload) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.post(`${BASE_URL}/add`, payload, config);
  return response.data;
}

export default {
  addIncome,
  getAllIncomeCategories,
  getAllUserIncomes,
};
