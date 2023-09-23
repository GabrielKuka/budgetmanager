import axios from "axios";
import {BASE_URL, BACKEND_PORT} from "../../config"

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

export default {
  getAllUserTransfers,
  addTransfer,
};
