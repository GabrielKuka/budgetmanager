import React from "react";
import "./nodata.scss";

const NoDataCard = (props) => {
    return (
        <div className={"no-data"}>
            <h1>{props.header}</h1>
            <label
                onClick={() => document.getElementById(props.focusOn).focus()}
            >
                {props.label}
            </label>
        </div>
    );
};

export default NoDataCard;
