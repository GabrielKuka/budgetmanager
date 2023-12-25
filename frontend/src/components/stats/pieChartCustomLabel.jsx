import { React } from "react";

const PieChartCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  outerRadius,
  name,
  value,
}) => {
  const radius = outerRadius + 30;
  const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
  const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));

  return (
    <>
      {value > 0 && value < 100 && (
        <text
          x={x}
          y={y}
          fill="#000"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {name}: {parseFloat(value).toFixed(2)}%
        </text>
      )}
    </>
  );
};

export default PieChartCustomizedLabel;
