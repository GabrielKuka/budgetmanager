import axios from "axios";

const BASE_URL = "http://localhost:8001/templates";

async function addTemplateGroup(payload) {
  const url = `${BASE_URL}/add-template-group`;

  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.post(url, payload, config);
  if (response.status == 201) {
    return response.data;
  } else {
    alert("Error adding template");
  }
}

async function deleteTemplateGroup(id) {
  const url = `${BASE_URL}/delete-template-group/${id}`;

  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.delete(url, config);
  if (response.status == 200) {
    return response.data;
  } else {
    alert("Error deleting template");
  }
}

async function getTemplateGroups() {
  const url = `${BASE_URL}/get-template-groups`;

  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.get(url, config);
  if (response.status == 200) {
    return response.data;
  } else {
    alert("Error adding template group");
  }
}

export default {
  addTemplateGroup,
  deleteTemplateGroup,
  getTemplateGroups,
};
