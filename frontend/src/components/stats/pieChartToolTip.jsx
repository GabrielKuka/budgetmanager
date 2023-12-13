import { React } from "react";

const PieChartToolTip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: data.fill,
          padding: "5px",
          borderRadius: "3px",
          height: "50px",
          color: "white",
        }}
      >
        <p>
          <b>{`${data.name} : ${parseFloat(data.value).toFixed(2)}%`}</b>
        </p>
      </div>
    );
  }

  return null;
};

export default PieChartToolTip;
