import React, { useEffect, useRef } from "react";
import "./confirm.scss";

const CONFIRM_LABELS = {
  danger: { yes: "Yes, Delete", icon: "⚠️" },
  info: { yes: "Yes", icon: "ℹ️" },
};

const ConfirmDialog = ({ message, show, variant, confirmLabel, onYes, setShow }) => {
  const dialogRef = useRef(null);
  const labels = CONFIRM_LABELS[variant] || CONFIRM_LABELS.danger;
  const confirmText = confirmLabel || labels.yes;

  useEffect(() => {
    if (!show) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setShow(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [show, setShow]);

  function handleBackdropClick(e) {
    if (dialogRef.current && !dialogRef.current.contains(e.target)) {
      setShow(false);
    }
  }

  function handleNo() {
    setShow(false);
  }

  function handleYes() {
    setShow(false);
    onYes();
  }

  return (
    <div className="confirm-overlay" onClick={handleBackdropClick}>
      <div
        ref={dialogRef}
        className={`confirm-dialog ${show ? "confirm-dialog--open" : ""}`}
      >
        <div className="confirm-dialog__icon">{labels.icon}</div>
        <h2 className="confirm-dialog__title">Confirm Action</h2>
        <p className="confirm-dialog__message">{message}</p>
        <div className="confirm-dialog__actions">
          <button className="confirm-btn confirm-btn--cancel" onClick={handleNo}>
            Cancel
          </button>
          <button
            className={`confirm-btn confirm-btn--${variant}`}
            onClick={handleYes}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
