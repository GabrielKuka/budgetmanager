import { Sankey, Tooltip, Rectangle, Layer } from "recharts";
import { helper } from "../helper";
import { useGlobalContext } from "../../context/GlobalContext";

const MonthlyFinancesSankeyChart = (props) => {
  const chartData = props.data;

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
