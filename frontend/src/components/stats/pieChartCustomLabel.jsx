import { React } from "react";

const PieChartCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  name,
  value,
}) => {
  const radius = outerRadius + 40;
  const RADIAN = Math.PI / 180;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <>
      {value > 0 && value < 100 && (
        <>
          <text
            x={x}
            y={y}
            fill="#000"
            textAnchor={x > cx ? "start" : "end"}
            dominantBaseline="central"
            fontWeight="bold"
          >
            {name}: {parseFloat(value).toFixed(2)}%
          </text>
        </>
      )}
    </>
  );
};

export default PieChartCustomizedLabel;
