import React from "react";
import "./loadingCard.scss";

const LoadingCard = (props) => {
  return (
    <div className={"loading-card"}>
      <h1>{props.header}</h1>
      {props.label && (
        <label onClick={() => document.getElementById(props.focusOn).focus()}>
          {props.label}
        </label>
      )}
    </div>
  );
};

export default LoadingCard;
