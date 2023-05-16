import React, { useState, useEffect } from "react";
import "./confirm.scss";

const ConfirmDialog = (props)=>{

    const [show, setShow] = useState(false)

    useEffect(()=>{
        setShow(true)
    }, [props.message])

    return (
        <div className={show ? 'confirm-dialog__wrapper show': 'confirm-dialog'}>
            <div className={'header'}>
                <img alt="info-icon" src={process.env.PUBLIC_URL+'/info.png'}/>
                <label>{props.message}</label>
            </div>
            <hr />
            <div className={'action-buttons'}>
                <button className={'no'} onClick={()=>setShow(false)}>No</button>
                <button className={'yes'} onClick={()=>setShow(false)}>Yes</button>
            </div>
        </div>
    )
}

export default ConfirmDialog