import React, { useState, useEffect } from "react";
import { Formik, Form, Field } from "formik";
import transactionService from "../../services/transactionService/transactionService";
import DatePicker from "react-datepicker";
import "./transfers.scss";
import NoDataCard from "../core/nodata";
import { useToast } from "../../context/ToastContext";

const Transfers = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [transfers, setTransfers] = useState([]);
    const [accounts, setAccounts] = useState([]);

    useEffect(() => {
        getTransfers();
        getAccounts();
    }, []);

    async function getAccounts() {
        const accounts = await transactionService.getAllUserAccounts();
        setAccounts(accounts);
    }
    async function getTransfers() {
        const transfers = await transactionService
            .getAllUserTransfers()
            .finally(() => setIsLoading(false));
        setTransfers(transfers);
    }

    return (
        <div className={"transfers-wrapper"}>
            <Sidebar
                accounts={accounts}
                refreshTransfers={getTransfers}
                refreshAccounts={getAccounts}
            />
            {!isLoading && (
                <>
                    {!transfers.length ? (
                        <NoDataCard
                            header={"No transfers found."}
                            label={"Add a transfer"}
                            focusOn={"date"}
                        />
                    ) : (
                        <TransfersList
                            transfers={transfers}
                            accounts={accounts}
                        />
                    )}
                </>
            )}
        </div>
    );
};

const Sidebar = ({ accounts, refreshTransfers, refreshAccounts }) => {
    return (
        <div className={"transfers-wrapper__sidebar"}>
            <AddTransfer
                accounts={accounts}
                refreshTransfers={refreshTransfers}
                refreshAccounts={refreshAccounts}
            />
        </div>
    );
};

const AddTransfer = ({ accounts, refreshTransfers, refreshAccounts }) => {
    const showToast = useToast();
    return (
        <div className={"enter-transfer"}>
            <Formik
                initialValues={{
                    amount: "",
                    from_account: "",
                    to_account: "",
                    description: "",
                    date: new Date().toISOString().slice(0, 10),
                }}
                onSubmit={async (values, { resetForm, setSubmitting }) => {
                    values["type"] = 2;
                    await transactionService.addTransfer(values);
                    await refreshTransfers();
                    await refreshAccounts();
                    showToast("Transfer Added", "info");
                    resetForm();
                    setSubmitting(false);
                }}
            >
                {() => (
                    <Form className={"form"}>
                        <label
                            onClick={() =>
                                document.getElementById("date").focus()
                            }
                        >
                            Enter Tranfer
                        </label>
                        <Field
                            type='text'
                            id='date'
                            name='date'
                            placeholder='Enter date'
                        />
                        <Field as='select' name='from_account'>
                            <option value='' disabled hidden>
                                From account
                            </option>
                            {accounts &&
                                accounts.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}{" "}
                                        {parseFloat(a.amount).toFixed(2)} €
                                    </option>
                                ))}
                        </Field>
                        <Field as='select' name='to_account'>
                            <option value='' disabled hidden>
                                To account
                            </option>
                            {accounts &&
                                accounts.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}{" "}
                                        {parseFloat(a.amount).toFixed(2)} €
                                    </option>
                                ))}
                        </Field>
                        <Field
                            type='text'
                            name='amount'
                            placeholder='Enter amount in EUR.'
                        />
                        <Field
                            type='text'
                            name='description'
                            placeholder='Enter a description'
                        />
                        <button type='submit'>Submit</button>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

const TransfersList = ({ transfers, accounts }) => {
    const [shownTransfers = transfers, setShownTransfers] = useState();

    const [dateRange, setDateRange] = useState({
        from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        to: new Date(),
    });

    useEffect(filterTransfers, [dateRange, transfers]);
    useEffect(filterTransfers, []);

    function filterTransfers() {
        const selectedFromAccount =
            document.getElementById("from_account").value;
        const selectedToAccount = document.getElementById("to_account").value;

        const fromDate = dateRange.from;
        const toDate = dateRange.to;

        const toAccountFilter =
            selectedToAccount >= 0
                ? transfers.filter((t) => t.to_account == selectedToAccount)
                : transfers;

        const fromAccountFilter =
            selectedFromAccount >= 0
                ? transfers.filter(
                      (t) => t.from_account == selectedFromAccount
                  )
                : transfers;

        const dateFilter = transfers.filter(
            (t) => new Date(t.date) >= fromDate && new Date(t.date) <= toDate
        );

        const filteredtransfers = toAccountFilter
            .filter((t) => fromAccountFilter.includes(t))
            .filter((t) => dateFilter.includes(t))
            .sort((a, b) => (a.date > b.date ? -1 : 1));
        setShownTransfers(filteredtransfers);
    }
    return (
        <div className={"transfers-wrapper__transfers-list"}>
            <div className={"header"}>
                <div>
                    <label>Date:</label>
                    <div className={"fromDatePicker"}>
                        <span className={"tooltip"}>From: </span>
                        <DatePicker
                            className='datepicker'
                            selected={dateRange.from}
                            onChange={(date) =>
                                setDateRange((prev) => ({
                                    ...prev,
                                    from: date,
                                }))
                            }
                            showMonthDropdown
                            dateFormat={"yyyy-MM-dd"}
                        />
                    </div>
                    <div className={"toDatePicker"}>
                        <span className={"tooltip"}>To:</span>
                        <DatePicker
                            className='datepicker'
                            selected={dateRange.to}
                            onChange={(date) =>
                                setDateRange((prev) => ({
                                    ...prev,
                                    to: date,
                                }))
                            }
                            showMonthDropdown
                            dateFormat={"yyyy-MM-dd"}
                        />
                    </div>
                </div>
                <label>Description</label>
                <div>
                    <label>From Account:</label>
                    <select
                        id='from_account'
                        defaultValue={"-1"}
                        onChange={filterTransfers}
                    >
                        <option value='-1'>All</option>
                        {accounts?.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label>To Account:</label>
                    <select
                        id='to_account'
                        defaultValue={"-1"}
                        onChange={filterTransfers}
                    >
                        <option value='-1'>All</option>
                        {accounts?.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                </div>
                <label>Amount</label>
            </div>
            <div className={"transfers"}>
                {shownTransfers?.length > 0 &&
                    shownTransfers.map((transfer) => (
                        <TransferItem
                            key={transfer.id}
                            transfer={transfer}
                            accounts={accounts}
                        />
                    ))}
            </div>
        </div>
    );
};

const TransferItem = ({ transfer, accounts }) => {
    function getAccountName(id) {
        const account = accounts.filter((a) => a.id === id);
        if (account?.length === 1) {
            return account[0].name;
        }
        return "Not found";
    }

    function isRecent(input_datetime) {
        const now = new Date();
        input_datetime = new Date(input_datetime);
        const diffInMs = now.getTime() - input_datetime.getTime();
        const diffInHrs = diffInMs / (1000 * 60 * 60);
        return diffInHrs <= 5;
    }
    return (
        <div className='transfer-item'>
            {isRecent(transfer.created_on) && (
                <label className='new-transaction'>NEW!</label>
            )}
            <label id='date'>{transfer.date}</label>
            <label id='description'>{transfer.description}</label>
            <label id='from_account'>
                {getAccountName(transfer.from_account)}
            </label>
            <label id='to_account'>
                {getAccountName(transfer.to_account)}
            </label>
            <label id='amount'>
                {parseFloat(transfer.amount).toFixed(2)} €
            </label>
        </div>
    );
};

export default Transfers;
