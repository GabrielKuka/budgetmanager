import { createContext, useState, useContext } from "react";
import Toast from "../components/core/toast";

const ToastContext = createContext();

const ToastProvider = ({ children }) => {
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const showToast = (message, status) => {
        setMessage(message);
        setStatus(status);
    };

    return (
        <ToastContext.Provider value={showToast}>
            {children}
            <Toast message={message} status={status} />
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
