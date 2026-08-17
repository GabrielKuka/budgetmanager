import axios from "axios";
import { BASE_URL, BACKEND_PORT } from "../config";

const ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/tangible-assets`;
const config = () => ({
  headers: { Authorization: `Token ${JSON.parse(localStorage.getItem("authToken"))}` },
});

const tangibleAssetService = {
  list: async (params = {}) => (await axios.get(ENDPOINT, { ...config(), params })).data,
  units: async () => (await axios.get(`${ENDPOINT}/units`, config())).data,
  create: async (payload) => (await axios.post(ENDPOINT, payload, config())).data,
  purchase: async (payload) => (await axios.post(`${ENDPOINT}/purchase`, payload, config())).data,
  valuations: async (id) => (await axios.get(`${ENDPOINT}/${id}/valuations`, config())).data,
  addValuation: async (id, payload) => (await axios.post(`${ENDPOINT}/${id}/valuations`, payload, config())).data,
  sell: async (id, payload) => (await axios.post(`${ENDPOINT}/${id}/sell`, payload, config())).data,
  dispose: async (id, payload) => (await axios.post(`${ENDPOINT}/${id}/dispose`, payload, config())).data,
  undo: async (id) => (await axios.post(`${ENDPOINT}/${id}/undo-last-event`, {}, config())).data,
};

export default tangibleAssetService;
