import axios from "axios";
import { BASE_URL, BACKEND_PORT } from "../../config";

const ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/transactions`;

async function getAllUserTransfers() {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.get(`${ENDPOINT}/alltransfers`, config);

  if (response.status === 200) {
    return response.data;
  } else {
    return "no data";
  }
}

async function addTransfer(payload) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.post(`${ENDPOINT}/add`, payload, config);
  return response.data;
}

async function deleteTransfer(payload) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.post(`${ENDPOINT}/delete`, payload, config);
  return response.data;
}

const transferService = {
  getAllUserTransfers,
  addTransfer,
  deleteTransfer,
};

export default transferService;
