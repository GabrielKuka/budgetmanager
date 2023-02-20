import axios from "axios";

const BASE_URL = "https://api.exchangerate.host";

async function convert(from, to, amount) {
  const response = axios.get(
    `${BASE_URL}/convert?from=${from}&to=${to}&amount=${amount}`
  );

  return response;
}

export default convert;
