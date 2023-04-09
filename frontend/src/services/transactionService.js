import axios from "axios";

const BASE_URL = "http://localhost:8000";

async function addTemplate(payload) {
    const url = `${BASE_URL}/templates/add-template`;

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

async function addTemplateGroup(payload) {
    const url = `${BASE_URL}/templates/add-template-group`;

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

async function getTemplateGroups() {
    const url = `${BASE_URL}/templates/get-template-groups`;

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

async function getTemplates() {
    const url = `${BASE_URL}/templates/get-templates`;

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

async function getAllExpenseCategories() {
    const response = await axios.get(
        `${BASE_URL}/transactions/expensecategories`
    );

    if (response.status === 200) {
        return response.data;
    } else {
        alert("Error fetching categories");
    }
}

async function getAllIncomeCategories() {
    const response = await axios.get(
        `${BASE_URL}/transactions/incomecategories`
    );

    if (response.status === 200) {
        return response.data;
    } else {
        alert("Error fetching categories.");
    }
}

async function getAllUserExpenses() {
    const token = JSON.parse(localStorage.getItem("authToken"));
    const config = {
        headers: {
            Authorization: token,
        },
    };

    const response = await axios.get(
        `${BASE_URL}/transactions/allexpenses`,
        config
    );

    if (response.status === 200) {
        return response.data;
    } else {
        return "no data";
    }
}

async function getAllUserIncomes() {
    const token = JSON.parse(localStorage.getItem("authToken"));
    const config = {
        headers: {
            Authorization: token,
        },
    };
    const response = await axios.get(
        `${BASE_URL}/transactions/allincomes`,
        config
    );
    if (response.status === 200) {
        return response.data;
    } else {
        return "no data";
    }
}

async function getAllUserTransfers() {
    const token = JSON.parse(localStorage.getItem("authToken"));
    const config = {
        headers: {
            Authorization: token,
        },
    };

    const response = await axios.get(
        `${BASE_URL}/transactions/alltransfers`,
        config
    );

    if (response.status === 200) {
        return response.data;
    } else {
        return "no data";
    }
}

async function getAllUserAccounts() {
    const token = JSON.parse(localStorage.getItem("authToken"));
    const config = {
        headers: {
            Authorization: token,
        },
    };
    const response = await axios.get(`${BASE_URL}/accounts/all`, config);

    if (response.status === 200) {
        return response.data;
    } else {
        return "no data";
    }
}

async function addExpense(payload) {
    const token = JSON.parse(localStorage.getItem("authToken"));
    const config = {
        headers: {
            Authorization: token,
        },
    };

    const response = await axios.post(
        `${BASE_URL}/transactions/add`,
        payload,
        config
    );
    if (response.status === 201) {
        return response.data;
    } else {
        alert("Error adding expense.");
    }
}

async function addIncome(payload) {
    const token = JSON.parse(localStorage.getItem("authToken"));
    const config = {
        headers: {
            Authorization: token,
        },
    };

    const response = await axios.post(
        `${BASE_URL}/transactions/add`,
        payload,
        config
    );
    if (response.status === 201) {
        return response.data;
    } else {
        alert("Error adding income.");
    }
}

async function addTransfer(payload) {
    const token = JSON.parse(localStorage.getItem("authToken"));
    const config = {
        headers: {
            Authorization: token,
        },
    };

    const response = await axios.post(
        `${BASE_URL}/transactions/add`,
        payload,
        config
    );
    if (response.status === 201) {
        return response.data;
    } else {
        alert("Error adding transfer.");
    }
}

async function addAccount(payload) {
    const token = JSON.parse(localStorage.getItem("authToken"));
    const config = {
        headers: {
            Authorization: token,
        },
    };

    const response = await axios.post(
        `${BASE_URL}/accounts/create`,
        payload,
        config
    );
    if (response.status === 201) {
        return response.data;
    } else {
        alert("Error creating account.");
    }
}

async function deleteAccount(payload) {
    const token = JSON.parse(localStorage.getItem("authToken"));
    const config = {
        headers: {
            Authorization: token,
        },
    };

    const response = await axios.delete(
        `${BASE_URL}/accounts/delete/${payload}`,
        config
    );
    if (response.status === 200) {
        return response.data;
    } else {
        alert("Error creating account.");
    }
}

export default {
    getAllIncomeCategories,
    getAllExpenseCategories,
    getAllUserAccounts,
    getAllUserExpenses,
    getAllUserTransfers,
    addExpense,
    addIncome,
    addTransfer,
    addAccount,
    deleteAccount,
    getAllUserIncomes,
    getTemplateGroups,
    addTemplateGroup,
    addTemplate,
    getTemplates,
};
