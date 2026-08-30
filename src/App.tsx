import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
    ArrowUpRight,
    CalendarDays,
    CirclePlus,
    Download,
    HandCoins,
    Pencil,
    PiggyBank,
    Plus,
    Receipt,
    Trash2,
    Users,
    WalletCards,
    X,
} from "lucide-react";
import InstallmentManager from "./InstallmentManager";
import AuctionManager from "./AuctionManager";
import IncomeManager from "./IncomeManager";
import { FeedbackPopup } from "./InstallmentModal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type TransactionType = "income" | "savings" | "expense";
type Transaction = {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: TransactionType;
};
type ApiTransaction = {
    id: string;
    transactionDate: string;
    description: string;
    amount: number;
    transactionType: TransactionType;
};
type Chit = {
    id: string;
    chitId: string;
    name: string;
    totalAmount: number;
    memberCount: number;
    monthlyInstallment: number;
    agentPercentage: number;
    startDate: string;
    durationMonths: number;
    status: string;
};
type Member = {
    id: string;
    name: string;
    mobileNumber: string;
    email?: string;
    permanentAddress?: string;
    chit?: { id: string; name: string };
    chitTaken: boolean;
};
type ChitDashboard = {
    chitId: string;
    totalCollectionOfMonth: number;
    availableBalance: number;
    membersNotPaid: number;
    latestHand: number | null;
    handsReleased: number;
    extraHands: number;
    amountDistributed: number;
    agentCommission: number;
    investmentIncome: number;
};
type ExportInstallment = { memberName: string; installmentDate: string; numberOfHand: number; installmentAmount: number };
type ExportAuction = { bidNo: number; auctionMonth: string; winningMemberName: string; handType: string; bidAmount: number; netAmountPaid: number; profitAmount: number };
type ExportIncome = { incomeAmount: number; percentage: number; numberOfMonths: number; interestEarnedAmount: number; createdAt: string; active: boolean };

const money = (value: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(value);
const monthLabel = (month: string) =>
    new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
        new Date(`${month}-01T00:00:00`),
    );
const today = new Date().toISOString().slice(0, 10);
const apiUrl = `${import.meta.env.VITE_API_URL || "http://localhost:8080/api"}/transactions`;

export default function App() {
    const [month, setMonth] = useState("2026-08");
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState("");
    const [apiSuccess, setApiSuccess] = useState("");
    const [editing, setEditing] = useState<Transaction | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [view, setView] = useState<"expenses" | "chits">("expenses");

    useEffect(() => {
        fetch(apiUrl)
            .then((response) => {
                if (!response.ok) throw new Error("Unable to load transactions");
                return response.json();
            })
            .then((items: ApiTransaction[]) => setTransactions(items.map(normalize)))
            .catch(() => {
                setApiError("Could not connect to the expense API.");
                setTransactions([]);
            })
            .finally(() => setLoading(false));
    }, []);

    const current = useMemo(
        () => transactions.filter((item) => item.date.startsWith(month)),
        [month, transactions],
    );
    const summary = useMemo(
        () => ({
            income: total(current, "income"),
            savings: total(current, "savings"),
            expenses: total(current, "expense"),
        }),
        [current],
    );
    const balance = summary.income - summary.savings - summary.expenses;
    const history = [
        ...new Set(transactions.map((item) => item.date.slice(0, 7))),
    ]
        .sort()
        .reverse();

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const item = {
            date: String(data.get("date")),
            description: String(data.get("description")),
            amount: Number(data.get("amount")),
            type: String(data.get("type")) as TransactionType,
        };
        const response = await fetch(editing ? `${apiUrl}/${editing.id}` : apiUrl, {
            method: editing ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item),
        });
        if (!response.ok) {
            setApiError("The transaction could not be saved.");
            return;
        }
        const saved = normalize(await response.json());
        setTransactions((items) =>
            editing
                ? items.map((old) => (old.id === editing.id ? saved : old))
                : [saved, ...items],
        );
        setEditing(null);
        setShowForm(false);
        setApiError("");
        setApiSuccess(editing ? "Transaction updated successfully." : "Transaction added successfully.");
    }

    async function remove(item: Transaction) {
        const response = await fetch(`${apiUrl}/${item.id}`, { method: "DELETE" });
        if (!response.ok) {
            setApiError("The transaction could not be deleted.");
            return;
        }
        setTransactions((items) => items.filter((old) => old.id !== item.id));
        setApiSuccess("Transaction deleted successfully.");
    }

    function exportMonth() {
        const escapeCsv = (value: string | number) =>
            `"${String(value).replace(/"/g, '""')}"`;
        const rows: Array<Array<string | number>> = [
            ["Ledgerly expense report", monthLabel(month)],
            [],
            ["Summary", "Amount"],
            ["Total income", summary.income],
            ["Savings", summary.savings],
            ["Other expenses", summary.expenses],
            ["Net balance", balance],
            [],
            ["Date", "Description", "Type", "Amount"],
            ...current.map((item) => [
                item.date,
                item.description,
                displayType(item.type),
                item.amount,
            ]),
        ];
        const csv = rows
            .map((row) => row.map((value) => escapeCsv(value)).join(","))
            .join("\r\n");
        const url = URL.createObjectURL(
            new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `ledgerly-expenses-${month}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    function openNew() {
        setEditing(null);
        setShowForm(true);
    }

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="brand">
                    <div className="brand-mark">
                        <WalletCards size={20} />
                    </div>
                    <span>ledgerly</span>
                </div>
                <p className="eyebrow">YOUR MONEY, CLEARLY</p>
                <button
                    className={view === "expenses" ? "nav-item active" : "nav-item"}
                    onClick={() => setView("expenses")}
                >
                    <Receipt size={18} />
                    Expenses
                </button>
                <button
                    className={view === "chits" ? "nav-item active" : "nav-item"}
                    onClick={() => setView("chits")}
                >
                    <HandCoins size={18} />
                    Chit Manager
                </button>
                <div className="sidebar-note">
                    <PiggyBank size={22} />
                    <strong>Keep it simple.</strong>
                    <span>Small habits add up.</span>
                </div>
                <div className="sidebar-footer">
                    Personal workspace
                    <br />
                    <span>{monthLabel(month)}</span>
                </div>
            </aside>
            <main className="main-content">
                <header className="topbar">
                    <div>
                        <p className="breadcrumb">Workspace / Expenses</p>
                        <h1>Good morning, Santhosh.</h1>
                    </div>
                    <div className="avatar">S</div>
                </header>
                <div className="page">
                    {view === "chits" ? (
                        <ChitManager />
                    ) : (
                        <>
                            {apiError && (
                                <FeedbackPopup
                                    message={apiError}
                                    type="error"
                                    close={() => {
                                        setApiError("");
                                        setApiSuccess("");
                                    }}
                                />
                            )}
                            {!apiError && apiSuccess && (
                                <FeedbackPopup message={apiSuccess} type="success" close={() => setApiSuccess("")} />
                            )}
                            <div className="page-heading">
                                <div>
                                    <p className="section-kicker">MONTHLY SNAPSHOT</p>
                                    <h2>Expenses</h2>
                                </div>
                                <div className="heading-controls">
                                    <label className="month-picker">
                                        <CalendarDays size={16} />
                                        <input
                                            type="month"
                                            value={month}
                                            onChange={(event) => setMonth(event.target.value)}
                                        />
                                    </label>
                                    <button
                                        className="secondary-button"
                                        onClick={exportMonth}
                                        disabled={loading}
                                        title="Download selected month as CSV"
                                    >
                                        <Download size={16} />
                                        Export
                                    </button>
                                    <button className="primary-button" onClick={openNew}>
                                        <Plus size={17} />
                                        Add transaction
                                    </button>
                                </div>
                            </div>
                            <section className="summary-grid">
                                <Card
                                    label="Total income"
                                    value={summary.income}
                                    icon={<ArrowUpRight />}
                                    tone="green"
                                />
                                <Card
                                    label="Savings"
                                    value={summary.savings}
                                    icon={<PiggyBank />}
                                    tone="yellow"
                                />
                                <Card
                                    label="Other expenses"
                                    value={summary.expenses}
                                    icon={<Receipt />}
                                    tone="coral"
                                />
                                <Card
                                    label="Net balance"
                                    value={balance}
                                    icon={<WalletCards />}
                                    tone="blue"
                                />
                            </section>
                            <div className="content-grid">
                                <section className="panel transactions-panel">
                                    <div className="panel-heading">
                                        <div>
                                            <h3>{monthLabel(month)} transactions</h3>
                                            <p>
                                                {loading
                                                    ? "Loading from expense-manager-mt..."
                                                    : `${current.length} entries this month`}
                                            </p>
                                        </div>
                                        <button
                                            className="icon-button"
                                            onClick={openNew}
                                            aria-label="Add transaction"
                                        >
                                            <CirclePlus size={20} />
                                        </button>
                                    </div>
                                    <div className="transaction-list">
                                        {current.length ? (
                                            current.map((item) => (
                                                <Row
                                                    key={item.id}
                                                    item={item}
                                                    edit={() => {
                                                        setEditing(item);
                                                        setShowForm(true);
                                                    }}
                                                    remove={() => remove(item)}
                                                />
                                            ))
                                        ) : (
                                            <div className="empty-state">
                                                {loading
                                                    ? "Loading transactions..."
                                                    : "No transactions for this month yet."}
                                            </div>
                                        )}
                                    </div>
                                </section>
                                <section className="panel monthly-panel">
                                    <div className="panel-heading">
                                        <div>
                                            <h3>Monthly history</h3>
                                            <p>Select a month to inspect it</p>
                                        </div>
                                    </div>
                                    <div className="history-list">
                                        {history.map((key) => (
                                            <button
                                                className={
                                                    key === month ? "history-row current" : "history-row"
                                                }
                                                key={key}
                                                onClick={() => setMonth(key)}
                                            >
                                                <span>
                                                    <strong>{monthLabel(key)}</strong>
                                                    <small>
                                                        {key === month
                                                            ? "Selected month"
                                                            : "View transactions"}
                                                    </small>
                                                </span>
                                                <span className="history-amount">
                                                    <strong>
                                                        {money(getBalance(key, transactions))}
                                                    </strong>
                                                    <small>balance</small>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            </div>
                            <p className="helper-copy">
                                <span className="dot"></span>Savings are set aside or invested.
                                Other expenses are money spent day to day.
                            </p>
                        </>
                    )}
                </div>
            </main>
            <nav className="mobile-nav" aria-label="Main navigation">
                <button
                    className={view === "expenses" ? "selected" : ""}
                    onClick={() => setView("expenses")}
                >
                    <Receipt size={18} />
                    Expenses
                </button>
                <button
                    className={view === "chits" ? "selected" : ""}
                    onClick={() => setView("chits")}
                >
                    <HandCoins size={18} />
                    Chit Manager
                </button>
            </nav>
            {showForm && (
                <Modal
                    title={editing ? "Edit transaction" : "Add transaction"}
                    close={() => setShowForm(false)}
                >
                    <form className="form" onSubmit={save}>
                        <label>
                            Date
                            <input
                                name="date"
                                type="date"
                                defaultValue={editing?.date || today}
                                required
                            />
                        </label>
                        <label>
                            Description
                            <input
                                name="description"
                                placeholder="e.g. Salary, Grocery"
                                defaultValue={editing?.description || ""}
                                required
                            />
                        </label>
                        <label>
                            Amount
                            <input
                                name="amount"
                                type="number"
                                min="1"
                                step="1"
                                placeholder="0"
                                defaultValue={editing?.amount || ""}
                                required
                            />
                        </label>
                        <label>
                            Type
                            <select name="type" defaultValue={editing?.type || "expense"}>
                                <option value="income">Income</option>
                                <option value="savings">Savings</option>
                                <option value="expense">Other expense</option>
                            </select>
                        </label>
                        <button className="primary-button submit-button" type="submit">
                            {editing ? "Save changes" : "Add transaction"}
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
}

function normalize(item: ApiTransaction): Transaction {
    return {
        id: item.id,
        date: item.transactionDate,
        description: item.description,
        amount: Number(item.amount),
        type: item.transactionType,
    };
}
function total(items: Transaction[], type: TransactionType) {
    return items
        .filter((item) => item.type === type)
        .reduce((sum, item) => sum + item.amount, 0);
}
function getBalance(month: string, transactions: Transaction[]) {
    return transactions
        .filter((item) => item.date.startsWith(month))
        .reduce(
            (balance, item) =>
                balance + (item.type === "income" ? item.amount : -item.amount),
            0,
        );
}
function displayType(type: TransactionType) {
    return type === "income"
        ? "Income"
        : type === "savings"
            ? "Savings"
            : "Other expense";
}
function Card({
    label,
    value,
    icon,
    tone,
}: {
    label: string;
    value: number;
    icon: ReactNode;
    tone: string;
}) {
    return (
        <div className="summary-card">
            <div className={`summary-icon ${tone}`}>{icon}</div>
            <div>
                <span>{label}</span>
                <strong>{money(value)}</strong>
            </div>
        </div>
    );
}
function Row({
    item,
    edit,
    remove,
}: {
    item: Transaction;
    edit: () => void;
    remove: () => void;
}) {
    return (
        <div className="transaction-row">
            <div className={`transaction-symbol ${item.type}`}>
                {item.type === "income" ? (
                    <ArrowUpRight size={18} />
                ) : item.type === "savings" ? (
                    <PiggyBank size={17} />
                ) : (
                    <Receipt size={17} />
                )}
            </div>
            <div className="transaction-info">
                <strong>{item.description}</strong>
                <span>
                    {new Date(`${item.date}T00:00:00`).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                    })}{" "}
                    <i>·</i> {displayType(item.type)}
                </span>
            </div>
            <strong className={item.type === "income" ? "amount positive" : "amount"}>
                {item.type === "income" ? "+" : "-"}
                {money(item.amount)}
            </strong>
            <div className="row-actions">
                <button onClick={edit} aria-label={`Edit ${item.description}`}>
                    <Pencil size={15} />
                </button>
                <button onClick={remove} aria-label={`Delete ${item.description}`}>
                    <Trash2 size={15} />
                </button>
            </div>
        </div>
    );
}
function Modal({
    title,
    close,
    children,
}: {
    title: string;
    close: () => void;
    children: ReactNode;
}) {
    return (
        <div
            className="modal-backdrop"
            onMouseDown={(event) => event.target === event.currentTarget && close()}
        >
            <div className="modal">
                <div className="modal-heading">
                    <h3>{title}</h3>
                    <button className="icon-button" onClick={close} aria-label="Close">
                        <X size={19} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function ChitManager() {
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
    const [chits, setChits] = useState<Chit[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [tab, setTab] = useState<"overview" | "members" | "installments" | "auctions" | "income">("overview");
    const [showChit, setShowChit] = useState(false);
    const [editingChit, setEditingChit] = useState<Chit | null>(null);
    const [showMember, setShowMember] = useState(false);
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [selectedChitId, setSelectedChitId] = useState("");
    const [dashboard, setDashboard] = useState<ChitDashboard | null>(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [formMemberCount, setFormMemberCount] = useState("");
    const [formInstallmentAmount, setFormInstallmentAmount] = useState("");
    const [exporting, setExporting] = useState(false);
    useEffect(() => {
        fetch(`${baseUrl}/chits`)
            .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
            .then(setChits)
            .catch(() => setError("Could not connect to the Chit Manager API."));
    }, []);
    useEffect(() => {
        if (!selectedChitId && chits.length) setSelectedChitId(chits[0].id);
    }, [chits, selectedChitId]);
    useEffect(() => {
        if (!selectedChitId) return;
        const loadSummary = () => fetch(`${baseUrl}/chits/${selectedChitId}/summary`)
            .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
            .then(setDashboard)
            .catch(() => setError("Could not load the selected chit dashboard."));
        loadSummary();
        window.addEventListener("installment-changed", loadSummary);
        window.addEventListener("auction-changed", loadSummary);
        return () => {
            window.removeEventListener("installment-changed", loadSummary);
            window.removeEventListener("auction-changed", loadSummary);
        };
    }, [selectedChitId]);
    useEffect(() => {
        if (tab !== "members" || !selectedChitId) return;
        const url = `${baseUrl}/members?chitId=${selectedChitId}`;
        fetch(url)
            .then((response) => {
                if (!response.ok) throw new Error();
                return response.json();
            })
            .then(setMembers)
            .catch(() => setError("Could not load members for this chit."));
    }, [tab, selectedChitId]);
    async function submitChit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        const response = await fetch(editingChit ? `${baseUrl}/chits/${editingChit.id}` : `${baseUrl}/chits`, {
            method: editingChit ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: data.name,
                totalAmount: Number(data.totalAmount),
                memberCount: Number(data.memberCount),
                monthlyInstallment: Number(data.monthlyInstallment),
                agentPercentage: Number(data.agentPercentage),
                startDate: data.startDate,
                durationMonths: Number(data.durationMonths),
            }),
        });
        if (!response.ok) {
            setError("Something went wrong. Please try again.");
            return;
        }
        const created = (await response.json()) as Chit;
        setChits((items) => editingChit ? items.map((item) => item.id === created.id ? created : item) : [created, ...items]);
        setShowChit(false);
        setEditingChit(null);
        setError("");
        setSuccess(editingChit ? "Chit updated successfully." : "Chit created successfully.");
    }

    async function deleteChit(chit: Chit) {
        if (!window.confirm(`Delete ${chit.name}? This also removes its members and installments.`)) return;
        const response = await fetch(`${baseUrl}/chits/${chit.id}`, { method: "DELETE" });
        if (!response.ok) { setError("Something went wrong. Please try again."); return; }
        setChits((items) => items.filter((item) => item.id !== chit.id));
        setSuccess("Chit deleted successfully.");
    }
    async function submitMember(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        const response = await fetch(
            editingMember
                ? `${baseUrl}/members/${editingMember.id}`
                : `${baseUrl}/members`,
            {
                method: editingMember ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...data,
                    chitId: String(data.chitId),
                }),
            },
        );
        if (!response.ok) {
            let message = "Something went wrong. Please try again.";
            try {
                const body = await response.json();
                if (typeof body.message === "string") message = body.message;
            } catch {
                // Use the common fallback when the backend has no response body.
            }
            setError(message);
            setShowMember(false);
            setEditingMember(null);
            return;
        }
        const saved = (await response.json()) as Member;
        setMembers((items) =>
            editingMember
                ? items.map((item) => (item.id === saved.id ? saved : item))
                : [...items, saved].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setShowMember(false);
        setEditingMember(null);
        setError("");
        setSuccess(editingMember ? "Member updated successfully." : "Member created successfully.");
    }

    async function deleteMember(member: Member) {
        if (!window.confirm(`Delete ${member.name}?`)) return;
        const response = await fetch(`${baseUrl}/members/${member.id}`, { method: "DELETE" });
        if (!response.ok) { setError("Something went wrong. Please try again."); return; }
        setMembers((items) => items.filter((item) => item.id !== member.id));
        setSuccess("Member deleted successfully.");
    }
    async function exportBackup() {
        if (!chits.length) {
            setError("There are no chits to export.");
            return;
        }
        setExporting(true);
        try {
            const pdf = new jsPDF({ unit: "mm", format: "a4" });
            for (const [index, chit] of chits.entries()) {
                if (index > 0) pdf.addPage();
                const [memberResponse, installmentResponse, auctionResponse, incomeResponse] = await Promise.all([
                    fetch(`${baseUrl}/members?chitId=${chit.id}`),
                    fetch(`${baseUrl}/installments?chitId=${chit.id}`),
                    fetch(`${baseUrl}/auctions?chitId=${chit.id}`),
                    fetch(`${baseUrl}/incomes?chitId=${chit.id}`),
                ]);
                if ([memberResponse, installmentResponse, auctionResponse, incomeResponse].some((response) => !response.ok)) throw new Error();
                const membersForExport = await memberResponse.json() as Member[];
                const installmentsForExport = await installmentResponse.json() as ExportInstallment[];
                const auctionsForExport = await auctionResponse.json() as ExportAuction[];
                const incomesForExport = await incomeResponse.json() as ExportIncome[];
                const pageWidth = pdf.internal.pageSize.getWidth();
                pdf.setFillColor(31, 91, 68);
                pdf.rect(0, 0, pageWidth, 34, "F");
                pdf.setTextColor(255, 255, 255);
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(22);
                pdf.text("LEDGERLY", 15, 16);
                pdf.setFontSize(10);
                pdf.setFont("helvetica", "normal");
                pdf.text("Chit financial backup", 15, 24);
                pdf.text(`Exported ${new Date().toLocaleDateString("en-IN")}`, pageWidth - 15, 24, { align: "right" });
                pdf.setTextColor(30, 40, 36);
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(17);
                pdf.text(chit.name, 15, 47);
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(9);
                pdf.setTextColor(115, 128, 121);
                pdf.text(`${chit.chitId}  |  ${chit.status.toUpperCase()}`, 15, 54);
                autoTable(pdf, {
                    startY: 61,
                    theme: "plain",
                    styles: { font: "helvetica", fontSize: 9, cellPadding: 3, textColor: [30, 40, 36] },
                    headStyles: { fillColor: [228, 242, 232], textColor: [45, 118, 86], fontStyle: "bold" },
                    head: [["Total amount", "Members", "Monthly installment", "Duration", "Agent"]],
                    body: [[money(chit.totalAmount), String(chit.memberCount), money(chit.monthlyInstallment), `${chit.durationMonths} months`, `${chit.agentPercentage}%`]],
                });
                let y = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 70;
                const section = (title: string, head: string[], body: string[][]) => {
                    if (y > 260) { pdf.addPage(); y = 18; }
                    pdf.setTextColor(31, 91, 68);
                    pdf.setFont("helvetica", "bold");
                    pdf.setFontSize(12);
                    pdf.text(title, 15, y + 12);
                    autoTable(pdf, {
                        startY: y + 16,
                        theme: "striped",
                        styles: { font: "helvetica", fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
                        headStyles: { fillColor: [31, 91, 68], textColor: [255, 255, 255] },
                        alternateRowStyles: { fillColor: [247, 250, 247] },
                        head: [head], body: body.length ? body : [["No records"]],
                    });
                    y = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 24;
                };
                section("Members", ["Name", "Mobile", "Email", "Status"], membersForExport.map((member) => [member.name, member.mobileNumber, member.email || "-", member.chitTaken ? "Taken" : "Not taken"]));
                section("Installments", ["Member", "Month / date", "Hand", "Amount"], installmentsForExport.sort((a, b) => `${b.installmentDate}`.localeCompare(`${a.installmentDate}`)).map((item) => [item.memberName, item.installmentDate, String(item.numberOfHand), money(Number(item.installmentAmount))]));
                section("Auctions", ["Bid", "Month", "Winner", "Hand", "Bid amount", "Profit"], auctionsForExport.map((item) => [`#${item.bidNo}`, item.auctionMonth, item.winningMemberName, item.handType, money(Number(item.bidAmount)), money(Number(item.profitAmount))]));
                section("Income", ["Income amount", "%", "Months", "Interest earned", "Created", "Status"], incomesForExport.map((item) => [money(Number(item.incomeAmount)), `${item.percentage}%`, String(item.numberOfMonths), money(Number(item.interestEarnedAmount)), new Date(item.createdAt).toLocaleDateString("en-IN"), item.active ? "Active" : "Deleted"]));
            }
            pdf.save(`ledgerly-chit-backup-${new Date().toISOString().slice(0, 10)}.pdf`);
            setSuccess("Chit backup exported successfully.");
        } catch {
            setError("Could not export the chit backup. Please try again.");
        } finally {
            setExporting(false);
        }
    }
    return (
        <>
            {error && (
                <FeedbackPopup message={error} type="error" close={() => setError("")} />
            )}
            {!error && success && (
                <FeedbackPopup message={success} type="success" close={() => setSuccess("")} />
            )}
            <div className="page-heading">
                <div>
                    <p className="section-kicker">GROUP SAVINGS WORKSPACE</p>
                    <h2>Chit Manager{chits.find((chit) => chit.id === selectedChitId) && <span className="selected-chit-name"> / {chits.find((chit) => chit.id === selectedChitId)?.name}</span>}</h2>
                </div>
                <div className="heading-controls">
                    <button
                        className="secondary-button"
                        onClick={() => {
                            setEditingMember(null);
                            setShowMember(true);
                            setError("");
                        }}
                    >
                        <Users size={16} />
                        Add member
                    </button>
                    <button className="secondary-button" onClick={exportBackup} disabled={exporting}>
                        <Download size={16} />
                        {exporting ? "Preparing..." : "Export PDF"}
                    </button>
                    <button className="primary-button" onClick={() => { setEditingChit(null); setFormMemberCount(""); setFormInstallmentAmount(""); setShowChit(true); }}>
                        <Plus size={17} />
                        Create chit
                    </button>
                </div>
            </div>
            <div className="summary-grid">
                <Card
                    label="Total collection of the month"
                    value={dashboard?.totalCollectionOfMonth ?? 0}
                    icon={<HandCoins />}
                    tone="green"
                />
                <Card
                    label="Available balance"
                    value={dashboard?.availableBalance ?? 0}
                    icon={<WalletCards />}
                    tone="blue"
                />
                <Card
                    label="Investment income"
                    value={dashboard?.investmentIncome ?? 0}
                    icon={<PiggyBank />}
                    tone="yellow"
                />
                <Card
                    label="Members not paid"
                    value={dashboard?.membersNotPaid ?? 0}
                    icon={<Users />}
                    tone="coral"
                />
            </div>
            <div className="tab-bar">
                <button
                    className={tab === "overview" ? "tab active" : "tab"}
                    onClick={() => setTab("overview")}
                >
                    Chit dashboard
                </button>
                <button
                    className={tab === "members" ? "tab active" : "tab"}
                    onClick={() => setTab("members")}
                >
                    Member module
                </button>
                <button
                    className={tab === "installments" ? "tab active" : "tab"}
                    onClick={() => setTab("installments")}
                >
                    Installments
                </button>
                <button
                    className={tab === "auctions" ? "tab active" : "tab"}
                    onClick={() => setTab("auctions")}
                >
                    Auctions
                </button>
                <button
                    className={tab === "income" ? "tab active" : "tab"}
                    onClick={() => setTab("income")}
                >
                    Income
                </button>
            </div>
            {tab === "overview" ? (
                <div className="chit-layout">
                    <section className="chit-list">
                        {chits.length ? (
                            chits.map((chit) => (
                                <div className={chit.id === selectedChitId ? "chit-card selected" : "chit-card"} key={chit.id} onClick={() => setSelectedChitId(chit.id)} role="button" tabIndex={0}>
                                    <div className="chit-card-top">
                                        <div className="chit-avatar">
                                            {chit.name.slice(0, 1).toUpperCase()}
                                        </div>
                                        <span className="status active">Active</span>
                                    </div>
                                    <strong>{chit.name}</strong>
                                    <div className="chit-card-meta">
                                        <span>{chit.chitId}</span>
                                        <span>{chit.memberCount} members</span>
                                        <span>Agent {chit.agentPercentage}%</span>
                                    </div>
                                    <div className="progress">
                                        <span style={{ width: "12%" }} />
                                    </div>
                                    <div className="card-actions">
                                        <button onClick={() => { setEditingChit(chit); setFormMemberCount(String(chit.memberCount)); setFormInstallmentAmount(String(chit.monthlyInstallment)); setShowChit(true); }} aria-label={`Edit ${chit.name}`}><Pencil size={14} />Edit</button>
                                        <button onClick={() => deleteChit(chit)} aria-label={`Delete ${chit.name}`}><Trash2 size={14} />Delete</button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">No chits created yet.</div>
                        )}
                    </section>
                    <section className="panel chit-detail">
                        <div className="detail-title">
                            <div>
                                <p className="section-kicker">PLANNING VIEW</p>
                                <h3>Monthly auctions and investments</h3>
                                <span>
                                    Track hands, bids, distributions, and unused funds from this
                                    workspace.
                                </span>
                            </div>
                        </div>
                        <div className="detail-facts">
                            <div>
                                <span>Hands released</span>
                                <strong>{dashboard?.handsReleased ?? 0}</strong>
                            </div>
                            <div>
                                <span>Extra hands</span>
                                <strong>{dashboard?.extraHands ?? 0}</strong>
                            </div>
                            <div>
                                <span>Amount distributed</span>
                                <strong>{money(dashboard?.amountDistributed ?? 0)}</strong>
                            </div>
                            <div>
                                <span>Agent commission</span>
                                <strong>{money(dashboard?.agentCommission ?? 0)}</strong>
                            </div>
                        </div>
                        <div className="profit-box">
                            <div>
                                <span>Investment income earned</span>
                                <strong>{money(dashboard?.investmentIncome ?? 0)}</strong>
                            </div>
                            <small>
                                Add an investment from the module when unused funds are
                                deployed.
                            </small>
                        </div>
                    </section>
                </div>
            ) : tab === "members" ? (
                <section className="panel members-panel">
                    <div className="panel-heading">
                        <div>
                            <h3>Member directory</h3>
                            <p>{members.length} onboarded members</p>
                        </div>
                        <label className="member-filter">
                            <span>Chit</span>
                            <select value={selectedChitId} onChange={(event) => setSelectedChitId(event.target.value)}>
                                {chits.map((chit) => <option value={chit.id} key={chit.id}>{chit.name}</option>)}
                            </select>
                        </label>
                    </div>
                    {members.length ? (
                        members.map((member) => (
                            <div className="person-row member-row-button" key={member.id} onClick={() => { setEditingMember(member); setShowMember(true); setError(""); }} role="button" tabIndex={0}>
                                <div className="person-avatar">
                                    {member.name.slice(0, 1).toUpperCase()}
                                </div>
                                <div>
                                    <strong>{member.name}</strong>
                                    <span>
                                        {member.mobileNumber}
                                        {member.email ? ` · ${member.email}` : ""}
                                    </span>
                                </div>
                                <span className="member-state">{member.chit?.name || "Chit member"}</span>
                                <span className={member.chitTaken ? "status active" : "status"}>{member.chitTaken ? "Taken" : "Not taken"}</span>
                                <span className="member-actions"><button type="button" onClick={(event) => { event.stopPropagation(); deleteMember(member); }} aria-label={`Delete ${member.name}`}><Trash2 size={14} /></button></span>
                            </div>
                        ))
                    ) : (
                        <div className="empty-state">
                            Add your first member to begin onboarding.
                        </div>
                    )}
                </section>
            ) : tab === "installments" ? <InstallmentManager initialChitId={selectedChitId} /> : tab === "auctions" ? <AuctionManager initialChitId={selectedChitId} /> : <IncomeManager chitId={selectedChitId} />}
            {showChit && (
                <Modal title={editingChit ? "Edit chit" : "Create a chit"} close={() => { setShowChit(false); setEditingChit(null); }}>
                    <form className="form" onSubmit={submitChit}>
                        <label>
                            Chit name
                            <input
                                name="name"
                                placeholder="e.g. Family Circle 2026"
                                defaultValue={editingChit?.name || ""}
                                required
                            />
                        </label>
                        <label>
                            Number of members
                            <input name="memberCount" type="number" min="1" value={formMemberCount} onChange={(event) => setFormMemberCount(event.target.value)} required />
                        </label>
                        <label>
                            Installement Amt
                            <input name="monthlyInstallment" type="number" min="1" value={formInstallmentAmount} onChange={(event) => setFormInstallmentAmount(event.target.value)} required />
                        </label>
                        <label>
                            Chit Amt
                            <input name="totalAmount" type="number" min="1" value={(Number(formMemberCount) * Number(formInstallmentAmount)) || ""} readOnly required />
                        </label>
                        <label>
                            Duration
                            <input name="durationMonths" type="number" min="1" defaultValue={editingChit?.durationMonths || ""} required />
                        </label>
                        <label>
                            Agent percentage
                            <input name="agentPercentage" type="number" min="0" max="100" step="0.01" defaultValue={editingChit?.agentPercentage ?? 0} required />
                        </label>
                        <label>
                            Start date
                            <input name="startDate" type="date" defaultValue={editingChit?.startDate || ""} required />
                        </label>
                        <button className="primary-button submit-button" type="submit">
                            {editingChit ? "Save changes" : "Create chit"}
                        </button>
                    </form>
                </Modal>
            )}
            {showMember && (
                <Modal title={editingMember ? "Update member" : "Onboard a member"} close={() => { setShowMember(false); setEditingMember(null); }}>
                    <form className="form" onSubmit={submitMember}>
                        <label>
                            Chit name
                            <select name="chitId" defaultValue={editingMember?.chit?.id || selectedChitId} required>
                                <option value="" disabled>Select a chit</option>
                                {chits.map((chit) => <option value={chit.id} key={chit.id}>{chit.name}</option>)}
                            </select>
                        </label>
                        <label>
                            Name
                            <input name="name" defaultValue={editingMember?.name || ""} required />
                        </label>
                        <label>
                            Mobile number
                            <input name="mobileNumber" type="tel" defaultValue={editingMember?.mobileNumber || ""} required />
                        </label>
                        <label>
                            Email address
                            <input name="email" type="email" defaultValue={editingMember?.email || ""} />
                        </label>
                        <label>
                            Permanent address
                            <textarea name="permanentAddress" rows={3} defaultValue={editingMember?.permanentAddress || ""} />
                        </label>
                        <button className="primary-button submit-button" type="submit">
                            {editingMember ? "Save member" : "Add member"}
                        </button>
                    </form>
                </Modal>
            )}
        </>
    );
}
