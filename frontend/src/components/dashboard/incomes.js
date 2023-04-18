import React, { useState, useEffect } from "react";
import transactionService from "../../services/transactionService/transactionService";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Formik, Form, Field } from "formik";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";
import "./incomes.scss";
import NoDataCard from "../core/nodata";

const Incomes = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [categories, setCategories] = useState([]);
    const [accounts, setAccounts] = useState([]);

    const [incomes, setIncomes] = useState([]);
    const [shownIncomes = incomes, setShownIncomes] = useState();

    const [dateRange, setDateRange] = useState({
        from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        to: new Date(),
    });

    useEffect(() => {
        getAccounts();
        getCategories();
        getIncomes();
    }, []);

    async function getAccounts() {
        const accounts = await transactionService.getAllUserAccounts();
        setAccounts(accounts);
    }
    async function getCategories() {
        const categories = await transactionService.getAllIncomeCategories();
        setCategories(categories);
    }
    async function getIncomes() {
        const incomes = await transactionService
            .getAllUserIncomes()
            .finally(() => setIsLoading(false));
        setIncomes(incomes);
    }

    return (
        <div className={"incomes-wrapper"}>
            <Sidebar
                accounts={accounts}
                categories={categories}
                refreshIncomes={getIncomes}
                refreshAccounts={getAccounts}
                shownIncomes={shownIncomes}
                dateRange={dateRange}
            />
            {!isLoading && (
                <>
                    {!incomes.length ? (
                        <NoDataCard
                            header={"No incomes found."}
                            label={"Add an income."}
                            focusOn={"date"}
                        />
                    ) : (
                        <IncomesList
                            incomes={incomes}
                            shownIncomes={shownIncomes}
                            setShownIncomes={setShownIncomes}
                            categories={categories}
                            accounts={accounts}
                            dateRange={dateRange}
                            setDateRange={setDateRange}
                        />
                    )}
                </>
            )}
        </div>
    );
};

const Sidebar = (props) => {
    function getIncomesPerCategory() {
        const data = [];

        props.categories.forEach((c) => {
            let result = props.shownIncomes
                .filter((e) => e.income_category == c.id)
                .reduce((t, obj) => (t += parseFloat(obj.amount)), 0)
                .toFixed(2);
            data.push({
                category: c.category_type,
                amount: result,
            });
        });

        return data;
    }

    return (
        <div className={"incomes-wrapper__sidebar"}>
            <AddIncome
                accounts={props.accounts}
                categories={props.categories}
                refreshIncomes={props.refreshIncomes}
                refreshAccounts={props.refreshAccounts}
            />
            <Chart data={getIncomesPerCategory()} />
        </div>
    );
};

const Chart = (props) => {
    const yMaxValue = Math.max(...props.data.map((o) => o.amount));
    return (
        <BarChart
            className={"bar-chart"}
            margin={{ left: 0, right: 0 }}
            width={330}
            height={250}
            data={props.data}
            barSize={20}
        >
            <XAxis dataKey='category' />
            <YAxis type='number' tickSize={2} domain={[0, yMaxValue]} />
            <Tooltip />
            <Bar dataKey='amount' fill='#8884d8' />
        </BarChart>
    );
};

const AddIncome = ({
    accounts,
    categories,
    refreshIncomes,
    refreshAccounts,
}) => {
    return (
        <div className={"enter-income"}>
            <Formik
                initialValues={{
                    amount: "",
                    account: "",
                    description: "",
                    income_category: "",
                    date: new Date().toISOString().slice(0, 10),
                }}
                onSubmit={async (values, { resetForm, setSubmitting }) => {
                    values["type"] = 0;
                    await transactionService.addIncome(values);
                    await refreshIncomes();
                    await refreshAccounts();
                    setSubmitting(false);
                    resetForm();
                }}
            >
                {() => (
                    <Form className={"form"}>
                        <label
                            onClick={() =>
                                document.getElementById("date").focus()
                            }
                        >
                            Enter Income
                        </label>
                        <Field
                            type='text'
                            id='date'
                            name='date'
                            placeholder='Eter date'
                        />
                        <Field as='select' name='account'>
                            <option value='' disabled hidden>
                                Select account
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
                        <Field as='select' name='income_category'>
                            <option value='' disabled hidden>
                                Income category
                            </option>
                            {categories &&
                                categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.category_type}
                                    </option>
                                ))}
                        </Field>
                        <button type='submit'>Submit</button>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

const IncomesList = (props) => {
    useEffect(filterIncomes, [props.dateRange, props.incomes]);
    useEffect(filterIncomes, []);

    function filterIncomes() {
        const selectedAccount = document.getElementById("account").value;
        const selectedCategory = document.getElementById("category").value;

        const fromDate = props.dateRange.from;
        const toDate = props.dateRange.to;

        const accountFilter =
            selectedAccount >= 0
                ? props.incomes.filter((e) => e.account == selectedAccount)
                : props.incomes;

        const categoryFilter =
            selectedCategory >= 0
                ? props.incomes.filter(
                      (e) => e.income_category == selectedCategory
                  )
                : props.incomes;

        const dateFilter = props.incomes.filter(
            (e) => new Date(e.date) >= fromDate && new Date(e.date) <= toDate
        );

        const filteredincomes = accountFilter
            .filter((e) => categoryFilter.includes(e))
            .filter((e) => dateFilter.includes(e))
            .sort((a, b) => (a.date > b.date ? -1 : 1));
        props.setShownIncomes(filteredincomes);
    }

    return (
        <div className={"incomes-wrapper__incomes-list"}>
            <div className={"header"}>
                <div>
                    <label>Date:</label>
                    <div className={"fromDatePicker"}>
                        <span className={"tooltip"}>From: </span>
                        <DatePicker
                            className='datepicker'
                            selected={props.dateRange.from}
                            onChange={(date) =>
                                props.setDateRange((prev) => ({
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
                            selected={props.dateRange.to}
                            onChange={(date) =>
                                props.setDateRange((prev) => ({
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
                    <label>Account:</label>
                    <select
                        id='account'
                        defaultValue={"-1"}
                        onChange={filterIncomes}
                    >
                        <option value='-1'>All</option>
                        {props.accounts?.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                </div>
                <label>Amount</label>
                <div>
                    <label>Category:</label>
                    <select
                        id='category'
                        defaultValue='-1'
                        onChange={filterIncomes}
                    >
                        <option value='-1'>All</option>
                        {props.categories &&
                            props.categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.category_type}
                                </option>
                            ))}
                    </select>
                </div>
            </div>
            <div className={"incomes"}>
                {props.shownIncomes?.length > 0 &&
                    props.shownIncomes.map((income) => (
                        <IncomeItem
                            key={income.id}
                            income={income}
                            accounts={props.accounts}
                            categories={props.categories}
                        />
                    ))}
            </div>
        </div>
    );
};

const IncomeItem = ({ income, accounts, categories }) => {
    function getAccountName(id) {
        const account = accounts.filter((a) => a.id === id);
        if (account?.length === 1) {
            return account[0].name;
        }
        return "Not found";
    }

    function getIncomeCategory(id) {
        const category = categories.filter((c) => c.id === id);
        if (category?.length === 1) {
            return category[0].category_type;
        }
        return "Not found.";
    }
    function isRecent(input_datetime) {
        const now = new Date();
        input_datetime = new Date(input_datetime);
        const diffInMs = now.getTime() - input_datetime.getTime();
        const diffInHrs = diffInMs / (1000 * 60 * 60);
        return diffInHrs <= 5;
    }

    return (
        <div className='income-item'>
            {isRecent(income.created_on) && (
                <label className='new-transaction'>NEW!</label>
            )}
            <label id='date'>{income.date}</label>
            <label id='description'>{income.description}</label>
            <label id='account'>{getAccountName(income.account)}</label>
            <label id='amount'>{parseFloat(income.amount).toFixed(2)} €</label>
            <label id='category'>
                {getIncomeCategory(income.income_category)}
            </label>
        </div>
    );
};

export default Incomes;
