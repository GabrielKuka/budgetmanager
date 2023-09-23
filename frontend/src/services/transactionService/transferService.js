import axios from "axios";

const BASE_URL = "http://localhost:8001/transactions";

async function getAllUserTransfers() {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.get(`${BASE_URL}/alltransfers`, config);

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

  const response = await axios.post(`${BASE_URL}/add`, payload, config);
  return response.data;
}

export default {
  getAllUserTransfers,
  addTransfer,
};
