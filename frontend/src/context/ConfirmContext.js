import { createContext, useState, useContext } from "react";
import ConfirmDialog from "../components/core/confirm";

const ConfirmContext = createContext();

const ConfirmProvider = ({ children }) => {
    const [message, setMessage] = useState("");
    const [show, setShow] = useState(false);
    const [action, setAction] = useState(false);

    const showConfirm = (message, callback) => {
        setShow(true)
        setMessage(message);
        setAction(()=>callback)    
    };

    function onYes(){
        if(action){
            action()
        } 
    }


    return (
        <ConfirmContext.Provider value={showConfirm}>
            {children}
            {show && 
                <ConfirmDialog message={message} show={show} onYes={onYes} setShow={setShow}/>
            }
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
