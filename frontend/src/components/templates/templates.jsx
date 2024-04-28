import React, { useState, useEffect } from "react";
import "./templates.scss";
import TemplateForm from "./templateForm";
import transactionService from "../../services/transactionService/transactionService";
import TemplateGroupForm from "./templateGroupForm";
import TemplateGroups from "./templateGroups";
import { useGlobalContext } from "../../context/GlobalContext";

const Template = () => {
  const types = ["Income", "Expense", "Transfer"];
  const global = useGlobalContext();
  const [accounts, setAccounts] = useState(global.activeAccounts);
  const [templateGroups, setTemplateGroups] = useState([]);

  const [incomeCategories, setIncomeCategories] = useState(
    global.incomeCategories
  );
  const [expenseCategories, setExpenseCategories] = useState(
    global.expenseCategories
  );

  useEffect(() => {
    getTemplateGroups();
  }, []);

  useEffect(() => {
    setAccounts(global.activeAccounts);
  }, [global.activeAccounts]);

  useEffect(() => {
    setIncomeCategories(global.incomeCategories);
  }, [global.incomeCategories]);

  useEffect(() => {
    setExpenseCategories(global.expenseCategories);
  }, [global.expenseCategories]);

  async function getTemplateGroups() {
    const response = await transactionService.getTemplateGroups();
    setTemplateGroups(response);
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
      {incomeCategories?.length > 0 &&
        expenseCategories?.length > 0 &&
        templateGroups?.length > 0 && (
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
