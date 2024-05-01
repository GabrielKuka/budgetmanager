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
  const [activeAccounts, setActiveAccounts] = useState(null);

  const [expenses, setExpenses] = useState(null);
  const [incomes, setIncomes] = useState(null);
  const [transfers, setTransfers] = useState(null);

  const [incomeCategories, setIncomeCategories] = useState(null);
  const [expenseCategories, setExpenseCategories] = useState(null);

  const [privacyMode, setPrivacyMode] = useState(false);

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

  useEffect(() => {
    if (authToken) {
      updateAccounts();
      updateExpenses();
      updateIncomes();
      updateTransfers();

      updateExpenseCategories();
      updateIncomeCategories();

      const storedPrivacyMode = localStorage.getItem("privacyMode");
      if (storedPrivacyMode) {
        setPrivacyMode(JSON.parse(storedPrivacyMode));
      }
    }
  }, []);

  const togglePrivacyMode = () => {
    const newPrivacyMode = !privacyMode;
    setPrivacyMode(newPrivacyMode);
    localStorage.setItem("privacyMode", JSON.stringify(newPrivacyMode));
  };

  async function updateAccounts() {
    const response = await accountService.getAllUserAccounts();
    setAccounts(response);

    const activeAcc = response.filter((a) => a.deleted == false);
    setActiveAccounts(activeAcc);
  }

  async function updateExpenses() {
    const response = await transactionService.getAllUserExpenses();
    setExpenses(response);
  }

  async function updateIncomes() {
    const response = await transactionService.getAllUserIncomes();
    setIncomes(response);
  }

  async function updateTransfers() {
    const response = await transactionService.getAllUserTransfers();
    setTransfers(response);
  }

  async function updateTransactions() {
    await updateIncomes();
    await updateExpenses();
    await updateTransfers();
    await updateAccounts();
  }

  const resetTransactions = () => {
    setIncomes([]);
    setExpenses([]);
    setTransfers([]);
  };

  const updateExpenseCategories = async () => {
    const response = await transactionService.getAllExpenseCategories();
    setExpenseCategories(response);
  };

  const updateIncomeCategories = async () => {
    const response = await transactionService.getAllIncomeCategories();
    setIncomeCategories(response);
  };

  const navigate = useNavigate();

  const loginUser = async (credentials) => {
    try {
      const result = await axios
        .post(`${userURL}/token`, credentials)
        .then(async (response) => {
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
            await updateTransactions();

            await updateExpenseCategories();
            await updateIncomeCategories();

            navigate("/dashboard");
          }
        });
    } catch (e) {
      if (e.response) {
        if (e.response.data.non_field_errors) {
          throw new Error(e.response.data.non_field_errors[0]);
        } else {
          throw new Error(e.response.data);
        }
      }
    }
  };

  const logoutUser = async () => {
    setauthToken(null);
    setUser(null);

    setAccounts([]);
    resetTransactions();

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
    activeAccounts,
    updateAccounts,

    expenses,
    incomes,
    transfers,

    updateExpenses,
    updateIncomes,
    updateTransfers,
    updateTransactions,

    incomeCategories,
    expenseCategories,

    updateExpenseCategories,
    updateIncomeCategories,

    privacyMode,
    togglePrivacyMode,
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
