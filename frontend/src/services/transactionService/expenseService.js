import axios from "axios";

const BASE_URL = "http://localhost:8000/transactions";

async function getAllExpenseCategories() {
  const response = await axios.get(`${BASE_URL}/expensecategories`);

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

  const response = await axios.get(`${BASE_URL}/allexpenses`, config);

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

  const response = await axios.post(`${BASE_URL}/add`, payload, config);
  return response.data;
}
export default {
  addExpense,
  getAllExpenseCategories,
  getAllUserExpenses,
};
