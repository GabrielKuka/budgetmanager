import React from "react";
import "./loadingCard.scss";

const LoadingCard = (props) => {
  return (
    <div className={"loading-card"}>
      <h1>{props.header}</h1>

      <img
        src={process.env.PUBLIC_URL + "/loading_icon.gif"}
        alt="loading icon"
        width="40"
        height="40"
      />
    </div>
  );
};

export default LoadingCard;
