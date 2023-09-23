import axios from "axios";

const BASE_URL = "http://localhost:8001/accounts";

async function getAllUserAccounts() {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };
  const response = await axios.get(`${BASE_URL}/all`, config);

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

  const response = await axios.post(`${BASE_URL}/create`, payload, config);
  if (response.status === 201) {
    return response.data;
  } else {
    alert("Error creating account.");
  }
}
async function deleteAccount(payload) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.delete(`${BASE_URL}/delete/${payload}`, config);
  if (response.status === 200) {
    return response.data;
  } else {
    alert("Error creating account.");
  }
}

export default {
  deleteAccount,
  getAllUserAccounts,
  addAccount,
};
