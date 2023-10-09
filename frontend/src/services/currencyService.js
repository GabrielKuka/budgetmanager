import axios from "axios";
import { CURRENCY_API_KEY, CURRENCY_BASE_URL } from "../config";


async function convert(from, to, amount) {
  const response = await axios.get(
    `${CURRENCY_BASE_URL}?apikey=${CURRENCY_API_KEY}&base_currency=${from}`
  )

  const result = parseFloat(response.data.data[to]*amount).toFixed(2)

  return result;
}

export default convert;
