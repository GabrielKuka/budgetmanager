import axios from "axios";
import { BASE_URL, BACKEND_PORT } from "../../config";

const ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/transactions`;

async function getUserTrades(dateRange) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const fmt = (d) =>
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0");

  const config = {
    params: {
      from_date: fmt(dateRange.from),
      to_date: fmt(dateRange.to),
    },
    headers: {
      Authorization: token,
    },
  };
  const response = await axios.get(`${ENDPOINT}/get_trades`, config);

  if (response.status === 200) {
    return response.data;
  } else {
    alert("Error fetching trades.");
  }
}

async function getAllUserTrades() {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.get(`${ENDPOINT}/alltrades`, config);

  if (response.status === 200) {
    return response.data;
  } else {
    return "no data";
  }
}

async function deleteTrade(payload) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.post(`${ENDPOINT}/delete`, payload, config);
  return response.data;
}

const tradeService = {
  getUserTrades,
  getAllUserTrades,
  deleteTrade,
};

export default tradeService;
