import axios from "axios";
import { BASE_URL, BACKEND_PORT } from "../config";

const ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/transactions`;

function authConfig(extra = {}) {
  return {
    ...extra,
    headers: {
      ...(extra.headers || {}),
      Authorization: JSON.parse(localStorage.getItem("authToken")),
    },
  };
}

async function search(params) {
  const normalized = typeof params === "string" ? { q: params } : params;
  const response = await axios.get(
    `${ENDPOINT}/search`,
    authConfig({ params: normalized })
  );
  return response.data;
}

async function suggestions(q, limit = 8) {
  const response = await axios.get(
    `${ENDPOINT}/search/suggestions`,
    authConfig({ params: { q, limit } })
  );
  return response.data.suggestions;
}

async function insights(params) {
  const response = await axios.get(
    `${ENDPOINT}/search/insights`,
    authConfig({ params })
  );
  return response.data;
}

async function dismissInsight(type, fingerprint) {
  await axios.post(
    `${ENDPOINT}/search/insights/dismiss`,
    { type, fingerprint },
    authConfig()
  );
}

async function getSavedSearches() {
  const response = await axios.get(`${ENDPOINT}/saved-searches`, authConfig());
  return response.data;
}

async function createSavedSearch(payload) {
  const response = await axios.post(
    `${ENDPOINT}/saved-searches`,
    payload,
    authConfig()
  );
  return response.data;
}

async function updateSavedSearch(id, payload) {
  const response = await axios.put(
    `${ENDPOINT}/saved-searches/${id}`,
    payload,
    authConfig()
  );
  return response.data;
}

async function deleteSavedSearch(id) {
  await axios.delete(`${ENDPOINT}/saved-searches/${id}`, authConfig());
}

async function bulkUpdate(payload) {
  const response = await axios.post(`${ENDPOINT}/bulk`, payload, authConfig());
  return response.data;
}

async function exportCsv(params, ids = []) {
  const response = ids.length
    ? await axios.post(
        `${ENDPOINT}/search/export`,
        { ids, currency: params.currency },
        authConfig({ responseType: "blob" })
      )
    : await axios.get(
        `${ENDPOINT}/search/export`,
        authConfig({ params, responseType: "blob" })
      );
  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = "transaction-search.csv";
  link.click();
  window.URL.revokeObjectURL(url);
}

const searchService = {
  search,
  suggestions,
  insights,
  dismissInsight,
  getSavedSearches,
  createSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
  bulkUpdate,
  exportCsv,
};

export default searchService;
