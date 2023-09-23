import { createContext, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import {BASE_URL, BACKEND_PORT} from "../config";
import axios from "axios";

const GlobalContext = createContext();

const GlobalProvider = ({ children }) => {

  const userURL = `${BASE_URL}:${BACKEND_PORT}/users`;

  const [authToken, setauthToken] = useState(() =>
    localStorage.getItem("authToken")
      ? JSON.parse(localStorage.getItem("authToken"))
      : null
  );
  const [user, setUser] = useState(
    localStorage.getItem("user")
      ? JSON.parse(localStorage.getItem("user"))
      : null
  );
  const navigate = useNavigate();

  const loginUser = async (credentials) => {
    const response = await axios.post(`${userURL}/token`, credentials);

    const data = response.data;
    if (response.status == 200) {
      const localUser = {
        token: data.token,
        data: await getUser(data.token),
      };

      setauthToken(data.token);
      setUser(localUser);

      localStorage.setItem("authToken", JSON.stringify(data.token));
      localStorage.setItem("user", JSON.stringify(localUser));

      navigate("/dashboard");
    } else {
      alert("Something went wrong!");
    }
  };

  const logoutUser = async () => {
    setauthToken(null);
    setUser(null);

    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const registerUser = async (credentials) => {
    const response = await axios.post(`${userURL}/register`, credentials);

    return response;
  };

  const getUser = async (token) => {
    const config = {
      headers: {
        Authorization: `token ${token}`,
      },
    };
    const response = await axios.get(`${userURL}/me`, config);

    return response.data;
  };

  const contextData = {
    user,
    setUser,
    authToken,
    setauthToken,
    loginUser,
    registerUser,
    logoutUser,
  };

  return (
    <GlobalContext.Provider value={contextData}>
      {children}
    </GlobalContext.Provider>
  );
};

export function useGlobalContext() {
  const state = useContext(GlobalContext);
  if (state === undefined) {
    throw new Error("no Global Context found");
  }

  return state;
}

export default GlobalProvider;
