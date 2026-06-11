import accountService from "./accountService";
import expenseService from "./expenseService";
import incomeService from "./incomeService";
import transferService from "./transferService";
import tradeService from "./tradeService";
import axios from "axios";
import { BASE_URL, BACKEND_PORT } from "../../config";
const ENDPOINT = `${BASE_URL}:${BACKEND_PORT}/transactions`;

// Get transaction in a timeframe
async function getTransactions(dateRange, currency) {
  return await expenseService.getTransactions(dateRange, currency);
}

// Accounts
async function getAllUserAccounts() {
  return await accountService.getAllUserAccounts();
}

async function addAccount(payload) {
  return await accountService.addAccount(payload);
}

async function deleteAccount(payload) {
  return await accountService.deleteAccount(payload);
}

async function softDeleteAccount(payload) {
  return await accountService.softDeleteAccount(payload);
}

async function restoreAccount(payload) {
  return await accountService.restoreAccount(payload);
}

// Expenses
async function getAllExpenseCategories() {
  return await expenseService.getAllExpenseCategories();
}

async function addExpense(payload) {
  return await expenseService.addExpense(payload);
}

async function deleteExpense(payload) {
  return await expenseService.deleteExpense(payload);
}

async function getAllUserExpenses() {
  return await expenseService.getAllUserExpenses();
}

async function getUserExpenses(dateRange) {
  return await expenseService.getUserExpenses(dateRange);
}

// Incomes
async function getAllIncomeCategories() {
  return await incomeService.getAllIncomeCategories();
}

async function getAllUserIncomes() {
  return await incomeService.getAllUserIncomes();
}

async function getUserIncomes(dateRange) {
  return await incomeService.getUserIncomes(dateRange);
}

async function addIncome(payload) {
  return incomeService.addIncome(payload);
}

async function deleteIncome(payload) {
  return incomeService.deleteIncome(payload);
}

// Transfers
async function getAllUserTransfers() {
  return await transferService.getAllUserTransfers();
}

async function getUserTransfers(dateRange) {
  return await transferService.getUserTransfers(dateRange);
}

async function addTransfer(payload) {
  return await transferService.addTransfer(payload);
}

async function deleteTransfer(payload) {
  return await transferService.deleteTransfer(payload);
}

// Trades
async function getUserTrades(dateRange) {
  return await tradeService.getUserTrades(dateRange);
}

async function getAllUserTrades() {
  return await tradeService.getAllUserTrades();
}

async function deleteTrade(payload) {
  return await tradeService.deleteTrade(payload);
}

async function togglePin(id) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };
  const response = await axios.post(`${ENDPOINT}/pin`, { id }, config);
  return response.data;
}

async function addTransaction(payload) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };
  const response = await axios.post(`${ENDPOINT}/add`, payload, config);
  return response.data;
}

async function updateTransaction(payload) {
  const token = JSON.parse(localStorage.getItem("authToken"));
  const config = {
    headers: {
      Authorization: token,
    },
  };
  const id = payload.id;
  const response = await axios.put(`${ENDPOINT}/update/${id}`, payload, config);
  return response.data;
}

const transactionService = {
  togglePin,
  updateTransaction,
  getAllIncomeCategories,
  getAllExpenseCategories,
  getAllUserAccounts,
  getAllUserExpenses,
  getAllUserTransfers,
  addExpense,
  deleteExpense,
  addIncome,
  deleteIncome,
  addTransfer,
  deleteTransfer,
  addAccount,
  softDeleteAccount,
  deleteAccount,
  restoreAccount,
  getAllUserIncomes,
  getTransactions,
  getUserExpenses,
  getUserIncomes,
  getUserTransfers,
  addTransaction,
  getUserTrades,
  getAllUserTrades,
  deleteTrade,
};

export default transactionService;
