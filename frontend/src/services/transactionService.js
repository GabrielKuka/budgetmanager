import axios from "axios";

const BASE_URL = "http://localhost:8000";

async function getAllExpenseCategories() {
  const response = await axios.get(
    `${BASE_URL}/transactions/expensecategories`
  );

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

  const response = await axios.get(
    `${BASE_URL}/transactions/allexpenses`,
    config
  );

  if (response.status === 200) {
    return response.data;
  } else {
    alert("Error retrieving expenses.");
  }
}

async function getAllUserAccounts() {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };
  const response = await axios.get(`${BASE_URL}/accounts/all`, config);

  if (response.status === 200) {
    return response.data;
  } else {
    alert("Error fetchign user accounts.");
  }
}

export default {
  getAllExpenseCategories,
  getAllUserAccounts,
  getAllUserExpenses,
};
