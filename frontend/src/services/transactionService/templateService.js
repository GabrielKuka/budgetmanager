import axios from "axios";

const BASE_URL = "http://localhost:8000/templates";

async function addTemplate(payload) {
    const url = `${BASE_URL}/add-template`;

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

async function getTemplates() {
    const url = `${BASE_URL}/get-templates`;

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
        alert("Error getting templates");
    }
}

export default { addTemplate, getTemplates };
