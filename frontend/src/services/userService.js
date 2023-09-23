import axios from "axios";

const BASE_URL = "http://localhost:8001/users";

async function getUserData() {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.get(`${BASE_URL}/user_data`, config);

  if (response.status === 200) {
    return response.data;
  } else {
    return "no data";
  }
}

export default { getUserData };
