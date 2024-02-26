import axios from "axios";
import { BASE_URL, BACKEND_PORT } from "../../config";

const ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/transactions`;

async function getAllExpenseCategories() {
  const response = await axios.get(`${ENDPOINT}/expensecategories`);

  if (response.status === 200) {
    console.log(response.data);
    return response.data;
  } else {
    alert("Error fetching categories");
  }
}

async function getAllUserExpenses() {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.get(`${ENDPOINT}/allexpenses`, config);

  if (response.status === 200) {
    return response.data;
  } else {
    return "no data";
  }
}

async function addExpense(payload) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.post(`${ENDPOINT}/add`, payload, config);
  return response.data;
}

async function deleteExpense(payload) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.post(`${ENDPOINT}/delete`, payload, config);
  return response.data;
}

const expenseService = {
  addExpense,
  deleteExpense,
  getAllExpenseCategories,
  getAllUserExpenses,
};

export default expenseService;
