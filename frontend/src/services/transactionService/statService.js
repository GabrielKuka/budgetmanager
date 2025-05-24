import axios from "axios";
import { BASE_URL, BACKEND_PORT } from "../../config";

const ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/transactions`;

async function getWealthStats(currency) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    params: {
      currency: currency,
    },
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.get(`${ENDPOINT}/get_wealth_stats`, config);
  if (response.status === 200) {
    return response.data;
  } else {
    alert("Error fetching wealth stats.");
  }
}

async function getFoodStats(currency) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    params: {
      currency: currency,
    },
    headers: {
      Authorization: token,
    },
  };
  const response = await axios.get(`${ENDPOINT}/get_food_stats`, config);

  if (response.status === 200) {
    return response.data;
  } else {
    return "no data";
  }
}

const statService = {
  getFoodStats,
  getWealthStats,
};

export default statService;
