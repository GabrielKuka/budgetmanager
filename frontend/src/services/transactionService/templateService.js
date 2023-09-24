import axios from "axios";
import { BASE_URL, BACKEND_PORT } from "../../config";

const ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/templates`;

async function addTemplate(payload) {
  const url = `${ENDPOINT}/add-template`;

  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.post(url, payload, config);
  if (response.status === 201) {
    return response.data;
  } else {
    alert("Error adding template");
  }
}

async function getTemplates() {
  const url = `${ENDPOINT}/get-templates`;

  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.get(url, config);
  if (response.status === 200) {
    return response.data;
  } else {
    alert("Error getting templates");
  }
}

const templateService = {
  addTemplate, getTemplates
}

export default templateService;
