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

async function getAllIncomeCategories() {
  const response = await axios.get(`${BASE_URL}/transactions/incomecategories`);

  if (response.status === 200) {
    return response.data;
  } else {
    alert("Error fetching categories.");
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

async function getAllUserIncomes() {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };
  const response = await axios.get(
    `${BASE_URL}/transactions/allincomes`,
    config
  );
  if (response.status === 200) {
    return response.data;
  } else {
    alert("Error retrieving incomes.");
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

async function addExpense(payload) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.post(
    `${BASE_URL}/transactions/add`,
    payload,
    config
  );
  if (response.status === 201) {
    return response.data;
  } else {
    alert("Error adding expense.");
  }
}

export default {
  getAllIncomeCategories,
  getAllExpenseCategories,
  getAllUserAccounts,
  getAllUserExpenses,
  addExpense,
  getAllUserIncomes,
};
