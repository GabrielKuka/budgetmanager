import axios from "axios";
import {BASE_URL, BACKEND_PORT} from "../config";


const ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/currencies`

async function convert(from, to, amount){
  if(from === to){
    return amount
  }

  const response = await axios.get(`${ENDPOINT}/convert/${from}/${to}/${amount}`)

  const result = response.data.conversion_result

  return result

}

async function convertInvestments(currency){
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.get(`${ENDPOINT}/convert_on_type/${currency}/1`, config)

  return response.data

}

async function convertCash(currency){
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.get(`${ENDPOINT}/convert_on_type/${currency}/2`, config)

  return response.data

}

async function convertBankAssets(currency){
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };

  const response = await axios.get(`${ENDPOINT}/convert_on_type/${currency}/0`, config)

  return response.data

}


const currencyService = {
  convert,
  convertInvestments,
  convertCash,
  convertBankAssets 
}

export default currencyService;
