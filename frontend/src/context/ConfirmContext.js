import { createContext, useState, useContext } from "react";
import ConfirmDialog from "../components/core/confirm";

const ConfirmContext = createContext();

const ConfirmProvider = ({ children }) => {
  const [message, setMessage] = useState("");
  const [show, setShow] = useState(false);
  const [action, setAction] = useState(false);
  const [variant, setVariant] = useState("danger");

  const showConfirm = (message, callback, options = {}) => {
    setShow(true);
    setMessage(message);
    setAction(() => callback);
    setVariant(options.variant || "danger");
  };

  function onYes() {
    if (action) {
      action();
    }
  }

  return (
    <ConfirmContext.Provider value={showConfirm}>
      {children}
      {show && (
        <ConfirmDialog
          message={message}
          show={show}
          variant={variant}
          onYes={onYes}
          setShow={setShow}
        />
      )}
    </ConfirmContext.Provider>
  );
};

export function useConfirm() {
  const state = useContext(ConfirmContext);
  if (state === undefined) {
    throw new Error("No Confirm Found.");
  }
  return state;
}

export default ConfirmProvider;
