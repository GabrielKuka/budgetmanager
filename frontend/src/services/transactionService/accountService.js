import axios from "axios";
import { BASE_URL, BACKEND_PORT } from "../../config";

const ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/accounts`;

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
    alert("Error creating account.");
  }
}

export default {
  deleteAccount,
  getAllUserAccounts,
  addAccount,
};
