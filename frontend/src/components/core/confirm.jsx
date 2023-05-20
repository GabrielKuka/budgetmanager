import React from "react";
import "./confirm.scss";

const ConfirmDialog = (props) => {
  function handleNo() {
    props.setShow(false);
  }

  function handleYes() {
    props.setShow(false);
    props.onYes();
  }

  return (
    <>
    <div className={'overlay'}></div>
    <div
      className={props.show ? "confirm-dialog__wrapper show" : "confirm-dialog"}
    >
      <div className={"header"}>
        <img alt="info-icon" src={process.env.PUBLIC_URL + "/info.png"} />
        <label>{props.message}</label>
      </div>
      <hr />
      <div className={"action-buttons"}>
        <button className={"no"} onClick={handleNo}>
          No
        </button>
        <button className={"yes"} onClick={handleYes}>
          Yes
        </button>
      </div>
    </div>
    </>
  );
};

export default ConfirmDialog;
