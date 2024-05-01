import axios from "axios";
import { BASE_URL, BACKEND_PORT } from "../config";

const ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/users`;

async function getUserData() {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.get(`${ENDPOINT}/user_data`, config);

  if (response.status === 200) {
    return response.data;
  } else {
    return "no data";
  }
}

async function deleteUser(payload) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.delete(`${ENDPOINT}/delete/${payload}`, config);
  return response.status == 204 ? true : false;
}

const userService = {
  getUserData,
  deleteUser,
};

export default userService;
