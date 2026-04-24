import { useState, useEffect } from "react";
import "./stats.scss";
import CurrentExpensesBarChart from "./currentExpensesBarChart";
import IncomeVsExpenseChart from "./incomeVsExpenseChart";
import { useGlobalContext } from "../../context/GlobalContext";
import MonthlyFinancesSankeyChart from "./monthlyFinancesSankeyChart";
import PercentExpensesPieChart from "./percentExpensesPie";
import transactionService from "../../services/transactionService/transactionService";
import WealthOverTime from "./wealthOverTime";

const Stats = () => {
  const global = useGlobalContext();

  const dateRange = {
    from: new Date(new Date().getFullYear() - 3, 0, 1),
    to: new Date(),
  };

  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);

  useEffect(() => {
    async function getTransactions() {
      const data = await transactionService.getTransactions(dateRange);
      setExpenses(data.expenses);
      setIncomes(data.incomes);
    }

    getTransactions();
  }, []);

  function getAccountCurrency(id) {
    const account = global.accounts?.filter((a) => a.id === id);
    if (account?.length === 1) {
      return account[0].currency;
    }

    return "Not Found";
  }

  function getTransactionCurrency(transaction) {
    if (!transaction) {
      return "Not Found";
    }

    const balanceId =
      transaction.transaction_type === "income"
        ? transaction.to_cash_balance
        : transaction.from_cash_balance;

    if (balanceId) {
      for (const account of global.accounts || []) {
        const matched = (account.cash_balances || []).find(
          (balance) => balance.id === balanceId
        );
        if (matched) {
          return matched.currency?.code || account.currency;
        }
      }
    }

    const fallbackAccountId =
      transaction.transaction_type === "income"
        ? transaction.to_account
        : transaction.from_account;
    return getAccountCurrency(fallbackAccountId);
  }

  return (
    <div className={"stats-wrapper"}>
      {global.incomes?.length > 0 &&
        global.expenses?.length > 0 &&
        global.expenseCategories?.length > 0 && (
          <>
            <div className={"chart-container"}>
              <MonthlyFinancesSankeyChart
                getAccountCurrency={getAccountCurrency}
                incomes={global.incomes}
                incomeCategories={global.incomeCategories}
                expenses={global.expenses}
                expenseCategories={global.expenseCategories}
                accounts={global.accounts}
                dateRange={dateRange}
              />
            </div>
            <div className={"chart-container"}>
              <CurrentExpensesBarChart
                stats={true}
                expenses={global.expenses?.filter(
                  (e) =>
                    new Date(e.date) >= dateRange.from &&
                    new Date(e.date) <= dateRange.to
                )}
                categories={global.expenseCategories}
                getAccountCurrency={getAccountCurrency}
                height={280}
                width={420}
              />
            </div>
            <div className={"chart-container"}>
              <IncomeVsExpenseChart
                getAccountCurrency={getAccountCurrency}
                getTransactionCurrency={getTransactionCurrency}
                height={300}
                width={480}
                expenses={expenses}
                incomes={incomes}
              />
            </div>
            <div className={"chart-container"} id="wealthOverTimeContainer">
              <WealthOverTime
                getAccountCurrency={getAccountCurrency}
                height={600}
                width={1000}
                expenses={expenses}
                incomes={incomes}
              />
            </div>
            <div className={"chart-container"}>
              <PercentExpensesPieChart
                expenses={global.expenses?.filter(
                  (e) =>
                    new Date(e.date) >= dateRange.from &&
                    new Date(e.date) <= dateRange.to
                )}
                categories={global.expenseCategories}
                getAccountCurrency={getAccountCurrency}
              />
              <label className="chart_label">
                Percentage of expenses per category.
              </label>
            </div>
          </>
        )}
    </div>
  );
};

export default Stats;
