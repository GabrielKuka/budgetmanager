import React, { useState, useEffect } from "react";
import "./toast.scss";

const Toast = (props) => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (props.message) {
            setShow(true);
            setTimeout(() => {
                setShow(false);
            }, 2000);
        }
    }, [props.message]);

    return (
        <div
            className={
                show
                    ? `toast-wrapper-${props.status} show`
                    : `toast-wrapper-${props.status}`
            }
        >
            <label>{props.message}</label>
        </div>
    );
};
export default Toast;
