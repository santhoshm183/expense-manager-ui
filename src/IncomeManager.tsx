import { FormEvent, useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { FeedbackPopup, Modal } from "./InstallmentModal";

type Income = {
    id: string;
    chitId: string;
    incomeAmount: number;
    percentage: number;
    numberOfMonths: number;
    interestEarnedAmount: number;
    createdAt: string;
    active: boolean;
};

const money = (value: number) => new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 2,
}).format(value);

export default function IncomeManager({ chitId }: { chitId: string }) {
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
    const [history, setHistory] = useState<Income[]>([]);
    const [incomeAmount, setIncomeAmount] = useState(0);
    const [editing, setEditing] = useState<Income | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [formPercentage, setFormPercentage] = useState(0);
    const [formMonths, setFormMonths] = useState(1);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    async function load() {
        if (!chitId) return;
        try {
            const [historyResponse, amountResponse] = await Promise.all([
                fetch(`${baseUrl}/incomes?chitId=${chitId}`),
                fetch(`${baseUrl}/incomes/amount?chitId=${chitId}`),
            ]);
            if (!historyResponse.ok || !amountResponse.ok) throw new Error();
            setHistory(await historyResponse.json());
            setIncomeAmount(Number(await amountResponse.json()));
        } catch {
            setError("Could not load income history.");
        }
    }

    useEffect(() => { load(); }, [chitId]);

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        const payload = {
            chitId,
            percentage: formPercentage,
            numberOfMonths: formMonths,
        };
        const response = await fetch(editing ? `${baseUrl}/incomes/${editing.id}` : `${baseUrl}/incomes`, {
            method: editing ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            let message = "Something went wrong. Please try again.";
            try { const body = await response.json(); if (typeof body.message === "string") message = body.message; } catch { /* common fallback */ }
            setError(message);
            return;
        }
        setShowForm(false);
        setEditing(null);
        setSuccess(editing ? "Income updated successfully." : "Income added successfully.");
        await load();
    }

    return <>
        {error && <FeedbackPopup message={error} type="error" close={() => setError("")} />}
        {!error && success && <FeedbackPopup message={success} type="success" close={() => setSuccess("")} />}
        <div className="page-heading">
            <div><p className="section-kicker">INCOME TRACKER</p><h2>Income history</h2></div>
            <button className="primary-button" onClick={() => { setEditing(null); setFormPercentage(0); setFormMonths(1); setShowForm(true); }}><Plus size={17} />Add income</button>
        </div>
        <section className="panel income-panel">
            {history.length ? history.map((income) => <div className="income-row" key={income.id}>
                <div><strong>{money(income.incomeAmount)}</strong><span>{income.percentage}% · {income.numberOfMonths} months</span></div>
                <div><span>Interest earned</span><strong>{money(income.interestEarnedAmount)}</strong></div>
                <div><span>Created</span><strong>{new Date(income.createdAt).toLocaleDateString("en-IN")}</strong></div>
                <span className={income.active ? "status active" : "status"}>{income.active ? "Active" : "Deleted"}</span>
                {income.active && <button className="icon-button" onClick={() => { setEditing(income); setFormPercentage(income.percentage); setFormMonths(income.numberOfMonths); setShowForm(true); }} aria-label="Edit active income"><Pencil size={15} /></button>}
            </div>) : <div className="empty-state">No income records for this chit.</div>}
        </section>
        {showForm && <Modal title={editing ? "Edit income" : "Add income"} close={() => { setShowForm(false); setEditing(null); }}>
            <form className="form" onSubmit={save}>
                <label>Income amount<input value={money(incomeAmount)} readOnly /></label>
                <label>Percentage<input name="percentage" type="number" min="0" max="100" step="0.01" value={formPercentage} onChange={(event) => setFormPercentage(Number(event.target.value))} required /></label>
                <label>Number of months<input name="numberOfMonths" type="number" min="1" max="12" value={formMonths} onChange={(event) => setFormMonths(Number(event.target.value))} required /></label>
                <label>Interest earned amount<input value={money(incomeAmount * formPercentage * formMonths / 100)} readOnly /></label>
                <button className="primary-button submit-button" type="submit">{editing ? "Save changes" : "Add income"}</button>
            </form>
        </Modal>}
    </>;
}
