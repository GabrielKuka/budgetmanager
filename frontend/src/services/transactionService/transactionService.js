import templateService from "./templateService";
import templateGroupsService from "./templateGroupsService";
import accountService from "./accountService";
import expenseService from "./expenseService";
import incomeService from "./incomeService";
import transferService from "./transferService";

const BASE_URL = "http://localhost:8000";

// Templates
async function addTemplate(payload) {
  return await templateService.addTemplate(payload);
}

async function getTemplates() {
  return await templateService.getTemplates();
}

// Template Groups
async function addTemplateGroup(payload) {
  return await templateGroupsService.addTemplateGroup(payload);
}

async function deleteTemplateGroup(id) {
  return await templateGroupsService.deleteTemplateGroup(id);
}

async function getTemplateGroups() {
  return await templateGroupsService.getTemplateGroups();
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

// Expenses
async function getAllExpenseCategories() {
  return await expenseService.getAllExpenseCategories();
}

async function addExpense(payload) {
  return await expenseService.addExpense(payload);
}

async function getAllUserExpenses() {
  return await expenseService.getAllUserExpenses();
}

// Incomes
async function getAllIncomeCategories() {
  return await incomeService.getAllIncomeCategories();
}

async function getAllUserIncomes() {
  return await incomeService.getAllUserIncomes();
}

async function addIncome(payload) {
  return incomeService.addIncome(payload);
}

// Transfers
async function getAllUserTransfers() {
  return await transferService.getAllUserTransfers();
}

async function addTransfer(payload) {
  return await transferService.addTransfer(payload);
}

export default {
  getAllIncomeCategories,
  getAllExpenseCategories,
  getAllUserAccounts,
  getAllUserExpenses,
  getAllUserTransfers,
  addExpense,
  addIncome,
  addTransfer,
  addAccount,
  deleteAccount,
  getAllUserIncomes,
  getTemplateGroups,
  addTemplateGroup,
  addTemplate,
  getTemplates,
  deleteTemplateGroup,
};
