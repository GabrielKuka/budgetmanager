import { createContext, useState, useContext } from "react";
import Toast from "../components/core/toast";

const ToastContext = createContext();

const ToastProvider = ({ children }) => {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [show, setShow] = useState(false);

  const showToast = (message, status = "info") => {
    if (!show) {
      setMessage(message);
      setStatus(status);
      setShow(true);

      setTimeout(() => {
        setShow(false);
        setStatus("info");
        setMessage("");
      }, 2000);
    }
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {show && <Toast message={message} show={show} status={status} />}
    </ToastContext.Provider>
  );
};

export function useToast() {
  const state = useContext(ToastContext);
  if (state === undefined) {
    throw new Error("No Toast Found.");
  }
  return state;
}

export default ToastProvider;
