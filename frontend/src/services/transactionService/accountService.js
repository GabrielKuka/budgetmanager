import axios from "axios";
import { BASE_URL, BACKEND_PORT } from "../../config";

const ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/accounts`;

async function getAccountStats(id) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };
  const response = await axios.get(`${ENDPOINT}/stats/${id}`, config);

  if (response.status === 200) {
    return response.data;
  } else {
    return "no data";
  }
}

async function getAccountTransactions(id) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };
  const response = await axios.get(`${ENDPOINT}/transactions/${id}`, config);

  if (response.status === 200) {
    return response.data;
  } else {
    return "no data";
  }
}

async function getAllUserAccounts() {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };
  const response = await axios.get(`${ENDPOINT}/all`, config);

  if (response.status === 200) {
    return response.data;
  } else {
    return "no data";
  }
}

async function addAccount(payload) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.post(`${ENDPOINT}/create`, payload, config);
  if (response.status === 201) {
    return response.data;
  } else {
    alert("Error creating account.");
  }
}

async function softDeleteAccount(payload) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };
  const response = await axios.put(
    `${ENDPOINT}/soft_delete/${payload}`,
    config
  );
  if (response.status === 200) {
    return response.data;
  } else {
    alert("Error deleting account.");
  }
}

async function restoreAccount(payload) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };
  const response = await axios.put(`${ENDPOINT}/restore/${payload}`, config);
  if (response.status === 200) {
    return response.data;
  } else {
    alert("Error restoring account.");
  }
}

async function deleteAccount(payload) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.delete(`${ENDPOINT}/delete/${payload}`, config);
  if (response.status === 200) {
    return response.data;
  } else {
    alert("Error deleting account.");
  }
}

const accountService = {
  getAccountStats,
  getAccountTransactions,
  softDeleteAccount,
  deleteAccount,
  restoreAccount,
  getAllUserAccounts,
  addAccount,
};

export default accountService;
