import React from "react";
import "./toast.scss";

const Toast = (props) => {
  return (
    <div
      className={`toast-wrapper-${props.status} ${props.show ? "" : "hide"}`}
    >
      <label>{props.message}</label>
    </div>
  );
};
export default Toast;
