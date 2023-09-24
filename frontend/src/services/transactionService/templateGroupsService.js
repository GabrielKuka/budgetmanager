import axios from "axios";
import { BASE_URL, BACKEND_PORT } from "../../config";

const ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/templates`;

async function addTemplateGroup(payload) {
  const url = `${ENDPOINT}/add-template-group`;

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

async function deleteTemplateGroup(id) {
  const url = `${ENDPOINT}/delete-template-group/${id}`;

  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.delete(url, config);
  if (response.status === 200) {
    return response.data;
  } else {
    alert("Error deleting template");
  }
}

async function getTemplateGroups() {
  const url = `${ENDPOINT}/get-template-groups`;

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
    alert("Error adding template group");
  }
}

const templateGroupService = {
  addTemplateGroup,
  deleteTemplateGroup,
  getTemplateGroups,
}

export default templateGroupService;
