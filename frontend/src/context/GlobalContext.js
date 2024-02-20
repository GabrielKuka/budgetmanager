import { createContext, useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BASE_URL, BACKEND_PORT } from "../config";
import axios from "axios";
import accountService from "../services/transactionService/accountService";
import transactionService from "../services/transactionService/transactionService";

const GlobalContext = createContext();

const GlobalProvider = ({ children }) => {
  const userURL = `${BASE_URL}:${BACKEND_PORT}/users`;
  const [accounts, setAccounts] = useState(null);

  const [expenses, setExpenses] = useState(null);
  const [incomes, setIncomes] = useState(null);
  const [transfers, setTransfers] = useState(null);

  const [incomeCategories, setIncomeCategories] = useState(null);
  const [expenseCategories, setExpenseCategories] = useState(null);

  useEffect(() => {
    updateAccounts();
    updateExpenses();
    updateIncomes();
    updateTransfers();

    updateExpenseCategories();
    updateIncomeCategories();
  }, []);

  const updateAccounts = async () => {
    const response = await accountService.getAllUserAccounts();
    setAccounts(response);
  };

  const updateExpenses = async () => {
    const response = await transactionService.getAllUserExpenses();
    setExpenses(response);
  };

  const updateIncomes = async () => {
    const response = await transactionService.getAllUserIncomes();
    setIncomes(response);
  };

  const updateTransfers = async () => {
    const response = await transactionService.getAllUserTransfers();
    setTransfers(response);
  };

  const updateExpenseCategories = async () => {
    const response = await transactionService.getAllExpenseCategories();
    setExpenseCategories(response);
  };

  const updateIncomeCategories = async () => {
    const response = await transactionService.getAllIncomeCategories();
    setIncomeCategories(response);
  };

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
    if (response.status === 200) {
      const localUser = {
        token: data.token,
        data: await getUser(data.token),
      };

      setauthToken(data.token);
      setUser(localUser);

      localStorage.setItem("authToken", JSON.stringify(data.token));
      localStorage.setItem("user", JSON.stringify(localUser));

      await updateAccounts();
      await updateIncomes();
      await updateExpenses();
      await updateTransfers();

      await updateExpenseCategories();
      await updateIncomeCategories();

      navigate("/dashboard");
    } else {
      alert("Something went wrong!");
    }
  };

  const logoutUser = async () => {
    setauthToken(null);
    setUser(null);

    setAccounts([]);
    setIncomes([]);
    setExpenses([]);
    setTransfers([]);

    setExpenseCategories([]);
    setIncomeCategories([]);

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

    accounts,
    updateAccounts,

    expenses,
    incomes,
    transfers,

    updateExpenses,
    updateIncomes,
    updateTransfers,

    incomeCategories,
    expenseCategories,

    updateExpenseCategories,
    updateIncomeCategories,
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
