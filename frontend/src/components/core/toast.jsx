import React from "react";
import "./toast.scss";

const Toast = (props) => {

    return (
        <div
            className={`toast-wrapper-${props.status}`}
        >
            <label>{props.message}</label>
        </div>
    );
};
export default Toast;
