import templateService from "./templateService";
import templateGroupsService from "./templateGroupsService";
import accountService from "./accountService";
import expenseService from "./expenseService";
import incomeService from "./incomeService";
import transferService from "./transferService";

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

async function deleteIncome(payload) {
  return incomeService.deleteIncome(payload);
}

// Transfers
async function getAllUserTransfers() {
  return await transferService.getAllUserTransfers();
}

async function addTransfer(payload) {
  return await transferService.addTransfer(payload);
}

async function deleteTransfer(payload) {
  return await transferService.deleteTransfer(payload);
}

const transactionService = {
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
  getTemplateGroups,
  addTemplateGroup,
  addTemplate,
  getTemplates,
  deleteTemplateGroup,
};

export default transactionService;
