import React, { useState, useEffect } from "react";
import "./templates.scss";
import TemplateForm from "./templateForm";
import transactionService from "../../services/transactionService/transactionService";
import TemplateGroupForm from "./templateGroupForm";
import TemplateGroups from "./templateGroups";

const Template = () => {
  const types = ["Income", "Expense", "Transfer"];
  const [accounts, setAccounts] = useState([]);
  const [templateGroups, setTemplateGroups] = useState([]);

  const [incomeCategories, setIncomeCategories] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);

  useEffect(() => {
    getAccounts();
    getIncomeCategories();
    getExpenseCategories();
    getTemplateGroups();
  }, []);

  async function getTemplateGroups() {
    const response = await transactionService.getTemplateGroups();
    setTemplateGroups(response);
  }

  async function getAccounts() {
    const response = await transactionService.getAllUserAccounts();
    setAccounts(response);
  }

  async function getIncomeCategories() {
    const response = await transactionService.getAllIncomeCategories();
    setIncomeCategories(response);
  }

  async function getExpenseCategories() {
    const response = await transactionService.getAllExpenseCategories();
    setExpenseCategories(response);
  }

  return (
    <div className={"template-wrapper"}>
      <Sidebar
        types={types}
        accounts={accounts}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        templateGroups={templateGroups}
        refreshTemplateGroups={getTemplateGroups}
      />
      {templateGroups?.length > 0 && (
        <TemplateGroups
          templateGroups={templateGroups}
          refreshTemplateGroups={getTemplateGroups}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
        />
      )}
    </div>
  );
};

const Sidebar = (props) => {
  const [templateGroupForm, setTemplateGroupForm] = useState(false);
  return (
    <div className={"template-wrapper__sidebar"}>
      <div className={"add-template"}>
        <TemplateForm
          types={props.types}
          accounts={props.accounts}
          incomeCategories={props.incomeCategories}
          expenseCategories={props.expenseCategories}
          templateGroups={props.templateGroups}
          templateGroupForm={templateGroupForm}
          refreshTemplateGroups={props.refreshTemplateGroups}
          setTemplateGroupForm={setTemplateGroupForm}
        />
      </div>
      {templateGroupForm && (
        <div className={"add-template_group"}>
          <TemplateGroupForm
            refreshTemplateGroups={props.refreshTemplateGroups}
          />
        </div>
      )}
    </div>
  );
};

export default Template;
