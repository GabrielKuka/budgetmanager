import axios from "axios";
import { BASE_URL, BACKEND_PORT } from "../config";

const ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/tangible-assets`;
const ASSET_ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/assets`;
const config = () => ({
  headers: {
    Authorization: `Token ${JSON.parse(localStorage.getItem("authToken"))}`,
  },
});

const tangibleAssetService = {
  portfolio: async (currency) =>
    (
      await axios.get(`${ASSET_ENDPOINT}/portfolio`, {
        ...config(),
        params: { currency },
      })
    ).data,
  activity: async (params = {}) =>
    (await axios.get(`${ASSET_ENDPOINT}/activity`, { ...config(), params }))
      .data,
  securities: async (query = "") =>
    (
      await axios.get(`${ASSET_ENDPOINT}/securities`, {
        ...config(),
        params: { query },
      })
    ).data,
  list: async (params = {}) =>
    (await axios.get(ENDPOINT, { ...config(), params })).data,
  units: async () => (await axios.get(`${ENDPOINT}/units`, config())).data,
  create: async (payload) =>
    (await axios.post(ENDPOINT, payload, config())).data,
  purchase: async (payload) =>
    (await axios.post(`${ENDPOINT}/purchase`, payload, config())).data,
  detail: async (id) => (await axios.get(`${ENDPOINT}/${id}`, config())).data,
  update: async (id, payload) =>
    (await axios.patch(`${ENDPOINT}/${id}`, payload, config())).data,
  remove: async (id) => axios.delete(`${ENDPOINT}/${id}`, config()),
  valuations: async (id) =>
    (await axios.get(`${ENDPOINT}/${id}/valuations`, config())).data,
  addValuation: async (id, payload) =>
    (await axios.post(`${ENDPOINT}/${id}/valuations`, payload, config())).data,
  deleteValuation: async (id, valuationId) =>
    axios.delete(`${ENDPOINT}/${id}/valuations/${valuationId}`, config()),
  sell: async (id, payload) =>
    (await axios.post(`${ENDPOINT}/${id}/sell`, payload, config())).data,
  dispose: async (id, payload) =>
    (await axios.post(`${ENDPOINT}/${id}/dispose`, payload, config())).data,
  undo: async (id) =>
    (await axios.post(`${ENDPOINT}/${id}/undo-last-event`, {}, config())).data,
};

export default tangibleAssetService;
