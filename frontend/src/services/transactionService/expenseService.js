import axios from "axios";
import { BASE_URL, BACKEND_PORT } from "../../config";

const ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/transactions`;

async function getTransactions(dateRange) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    params: {
      from_date: new Date(dateRange.from).toISOString().split("T")[0],
      to_date: new Date(dateRange.to).toISOString().split("T")[0],
    },
    headers: {
      Authorization: token,
    },
  };
  const response = await axios.get(`${ENDPOINT}/get_transactions`, config);

  if (response.status === 200) {
    return response.data;
  } else {
    alert("Error fetching transactions.");
  }
}

async function getAllExpenseCategories() {
  const response = await axios.get(`${ENDPOINT}/expensecategories`);

  if (response.status === 200) {
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

async function getUserExpenses(dateRange) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    params: {
      from_date: new Date(dateRange.from).toISOString().split("T")[0],
      to_date: new Date(dateRange.to).toISOString().split("T")[0],
    },
    headers: {
      Authorization: token,
    },
  };
  const response = await axios.get(`${ENDPOINT}/get_expenses`, config);

  if (response.status === 200) {
    return response.data;
  } else {
    alert("Error fetching transactions.");
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
  getUserExpenses,
  getTransactions,
};

export default expenseService;
