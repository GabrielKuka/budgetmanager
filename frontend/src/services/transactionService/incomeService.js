import axios from "axios";

const BASE_URL = "http://localhost:8000/transactions";

async function getAllIncomeCategories() {
    const response = await axios.get(`${BASE_URL}/incomecategories`);

    if (response.status === 200) {
        return response.data;
    } else {
        alert("Error fetching categories.");
    }
}
async function getAllUserIncomes() {
    const token = JSON.parse(localStorage.getItem("authToken"));
    const config = {
        headers: {
            Authorization: token,
        },
    };
    const response = await axios.get(`${BASE_URL}/allincomes`, config);
    if (response.status === 200) {
        return response.data;
    } else {
        return "no data";
    }
}

async function addIncome(payload) {
    const token = JSON.parse(localStorage.getItem("authToken"));
    const config = {
        headers: {
            Authorization: token,
        },
    };

    const response = await axios.post(`${BASE_URL}/add`, payload, config);
    if (response.status === 201) {
        return response.data;
    } else {
        alert("Error adding income.");
    }
}

export default {
    addIncome,
    getAllIncomeCategories,
    getAllUserIncomes,
};
