import { createContext, useState, useContext } from "react";
import ConfirmDialog from "../components/core/confirm";

const ConfirmContext = createContext();

const ConfirmProvider = ({ children }) => {
    const [message, setMessage] = useState("");

    const showConfirm = (message) => {
        setMessage(message);
    };

    return (
        <ConfirmContext.Provider value={showConfirm}>
            {children}
            <ConfirmDialog message={message}/>
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
