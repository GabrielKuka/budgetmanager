import { useEffect, useState } from "react";
import { Sankey, Tooltip, Rectangle, Layer } from "recharts";
import currencyService from "../../services/currencyService";
import { helper } from "../helper";
import { useGlobalContext } from "../../context/GlobalContext";
import transactionService from "../../services/transactionService/transactionService";

const MonthlyFinancesSankeyChart = (props) => {
  const [chartData, setChartData] = useState(false);
  const global = useGlobalContext();
  const dateRange = {
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  };

  useEffect(() => {
    async function getCurrentMonthTransactions() {
      const data = await transactionService.getTransactions(dateRange);

      return data;
    }

    async function getSumOfMonthlyTransactions(transactions) {
      if (!transactions) {
        return;
      }
      let promises = transactions?.map(async (e) => {
        return await currencyService.convert(
          props.getAccountCurrency(e.account),
          global.globalCurrency,
          e.amount
        );
      });

      const results = await Promise.all(promises);
      let total = results.reduce((acc, curr) => acc + parseFloat(curr), 0);

      return total;
    }

    async function getIncomesPerCategory(currentMonthIncomes) {
      if (!props.incomeCategories) {
        return;
      }
      const data = [];
      for (const c of props.incomeCategories) {
        let promises = currentMonthIncomes
          ?.filter((e) => e.income_category == c.id)
          ?.map(async (e) => {
            return await currencyService.convert(
              props.getAccountCurrency(e.account),
              global.globalCurrency,
              e.amount
            );
          });

        const results = await Promise.all(promises);
        const total = results.reduce((t, curr) => (t += parseFloat(curr)), 0);
        data.push({
          category: c.category === "Other" ? "Other " : c.category,
          amount: parseFloat(total).toFixed(2),
        });
      }

      return data;
    }

    async function getExpensesPerCategory(currentMonthExpenses) {
      if (!props.expenseCategories) {
        return;
      }
      const data = [];
      for (const c of props.expenseCategories) {
        let promises = currentMonthExpenses
          ?.filter((e) => e.expense_category == c.id)
          ?.map(async (e) => {
            return await currencyService.convert(
              props.getAccountCurrency(e.account),
              global.globalCurrency,
              e.amount
            );
          });

        const results = await Promise.all(promises);
        const total = results.reduce((t, curr) => (t += parseFloat(curr)), 0);
        data.push({
          category: c.category,
          amount: parseFloat(total).toFixed(2),
        });
      }

      return data;
    }

    async function prepareData() {
      const data = { nodes: [{ name: "Income", color: "green" }], links: [] };

      const transactions = await getCurrentMonthTransactions();

      const currentMonthIncomes = transactions.incomes;
      const currentMonthExpenses = transactions.expenses;

      const sumOfMonthlyIncomes = await getSumOfMonthlyTransactions(
        currentMonthIncomes
      );
      const incomesPerCategory = await getIncomesPerCategory(
        currentMonthIncomes
      );

      const sumOfMonthlyExpenses = await getSumOfMonthlyTransactions(
        currentMonthExpenses
      );
      const expensesPerCategory = await getExpensesPerCategory(
        currentMonthExpenses
      );

      for (const obj of incomesPerCategory) {
        if (parseFloat(obj.amount) === 0.0) {
          continue;
        }
        data["nodes"]?.push({
          name: obj.category,
          color: "#90ee90",
        });
        const sourceIndex = data.nodes
          ?.map((o) => o.name)
          .indexOf(obj.category);

        data["links"]?.push({
          source: sourceIndex,
          target: 0,
          value: parseFloat(obj.amount),
        });
      }

      for (const obj of expensesPerCategory) {
        if (parseFloat(obj.amount) === 0.0) {
          continue;
        }
        data?.nodes?.push({ name: obj.category, color: "#800000" });
        const targetIndex = data.nodes
          ?.map((o) => o.name)
          .indexOf(obj.category);

        data["links"]?.push({
          source: 0,
          target: targetIndex,
          value: parseFloat(obj.amount),
        });
      }

      data.nodes.push({ name: "Savings", color: "#0080FF" });
      data.links.push({
        source: 0,
        target: data.nodes.length - 1,
        value: parseFloat(
          (
            parseFloat(sumOfMonthlyIncomes) - parseFloat(sumOfMonthlyExpenses)
          ).toFixed(2)
        ),
      });
      setChartData(data);
    }

    prepareData();
  }, [, global.globalCurrency]);

  return (
    <>
      {chartData && (
        <>
          <Sankey
            height={450}
            width={960}
            data={chartData}
            linkCurvature={0.5}
            nodePadding={30}
            link={{ stroke: "gray", opacity: 0.8 }}
            node={<CustomNode />}
            margin={{
              left: 20,
              right: 80,
              top: 10,
              bottom: 20,
            }}
          >
            <Tooltip content={<CustomTooltip />} />
          </Sankey>
        </>
      )}
    </>
  );
};

function CustomNode({ x, y, width, height, index, payload, containerWidth }) {
  const global = useGlobalContext();
  const isOut = x + width + 6 > containerWidth;
  return (
    <Layer key={`CustomNode${index}`}>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={payload.color}
        fillOpacity="1"
      />
      <text
        textAnchor={isOut ? "end" : "start"}
        x={isOut ? x - 6 : x + width + 6}
        y={y + height / 2}
        fontSize="14"
        stroke="#333"
      >
        {payload.name}
      </text>
      <text
        textAnchor={isOut ? "end" : "start"}
        x={isOut ? x - 6 : x + width + 6}
        y={y + height / 2 + 13}
        fontSize="12"
        stroke="#333"
        strokeOpacity="0.5"
      >
        {helper.showOrMask(
          global.privacyMode,
          parseFloat(payload.value).toFixed(2)
        ) + helper.getCurrency(global.globalCurrency)}
      </text>
    </Layer>
  );
}

const CustomTooltip = ({ active, payload }) => {
  const global = useGlobalContext();
  if (!active || !payload) {
    return false;
  }

  const data = payload[0];
  const isLink = data?.name?.split(" - ")?.length == 2;
  if (isLink) {
    return false;
  }
  return (
    <div
      style={{
        backgroundColor: "cadetblue",
        padding: "5px",
        borderRadius: "3px",
        height: "50px",
        color: "white",
        height: "fit-content",
      }}
    >
      <b>{data.name}: </b>
      <b>
        {helper.showOrMask(
          global.privacyMode,
          parseFloat(data.value).toFixed(2)
        )}
        {helper.getCurrency(global.globalCurrency)}{" "}
      </b>
    </div>
  );
};

export default MonthlyFinancesSankeyChart;
