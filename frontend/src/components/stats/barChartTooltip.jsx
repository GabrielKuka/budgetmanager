import { useGlobalContext } from "../../context/GlobalContext";
import { helper } from "../helper";

const BarChartToolTip = ({ active, payload }) => {
  const global = useGlobalContext();
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: "cadetBlue",
          padding: "5px",
          borderRadius: "3px",
          height: "50px",
          color: "white",
        }}
      >
        <p>
          <b>{`${data.category} : ${helper.showOrMask(
            global.privacyMode,
            parseFloat(data.amount).toFixed(2)
          )}${helper.getCurrency(global.globalCurrency)}`}</b>
        </p>
      </div>
    );
  }

  return null;
};

export default BarChartToolTip;
