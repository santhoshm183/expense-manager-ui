import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, CalendarDays, CirclePlus, Download, Pencil, PiggyBank, Plus, Receipt, Trash2, WalletCards, X } from 'lucide-react'

type TransactionType = 'income' | 'savings' | 'expense'
type Transaction = { id: string; date: string; description: string; amount: number; type: TransactionType }
type ApiTransaction = { id: string; transactionDate: string; description: string; amount: number; transactionType: TransactionType }

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
const monthLabel = (month: string) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00`))
const today = new Date().toISOString().slice(0, 10)
const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:8080/api'}/transactions`

export default function App() {
    const [month, setMonth] = useState('2026-08')
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [apiError, setApiError] = useState('')
    const [editing, setEditing] = useState<Transaction | null>(null)
    const [showForm, setShowForm] = useState(false)

    useEffect(() => {
        fetch(apiUrl)
            .then((response) => { if (!response.ok) throw new Error('Unable to load transactions'); return response.json() })
            .then((items: ApiTransaction[]) => setTransactions(items.map(normalize)))
            .catch(() => { setApiError('Could not connect to the expense API.'); setTransactions([]) })
            .finally(() => setLoading(false))
    }, [])

    const current = useMemo(() => transactions.filter((item) => item.date.startsWith(month)), [month, transactions])
    const summary = useMemo(() => ({
        income: total(current, 'income'),
        savings: total(current, 'savings'),
        expenses: total(current, 'expense'),
    }), [current])
    const balance = summary.income - summary.savings - summary.expenses
    const history = [...new Set(transactions.map((item) => item.date.slice(0, 7)))].sort().reverse()

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const item = { date: String(data.get('date')), description: String(data.get('description')), amount: Number(data.get('amount')), type: String(data.get('type')) as TransactionType }
        const response = await fetch(editing ? `${apiUrl}/${editing.id}` : apiUrl, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
        if (!response.ok) { setApiError('The transaction could not be saved.'); return }
        const saved = normalize(await response.json())
        setTransactions((items) => editing ? items.map((old) => old.id === editing.id ? saved : old) : [saved, ...items])
        setEditing(null); setShowForm(false); setApiError('')
    }

    async function remove(item: Transaction) {
        const response = await fetch(`${apiUrl}/${item.id}`, { method: 'DELETE' })
        if (!response.ok) { setApiError('The transaction could not be deleted.'); return }
        setTransactions((items) => items.filter((old) => old.id !== item.id))
    }

    function exportMonth() {
        const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
        const rows: Array<Array<string | number>> = [
            ['Ledgerly expense report', monthLabel(month)], [], ['Summary', 'Amount'],
            ['Total income', summary.income], ['Savings', summary.savings], ['Other expenses', summary.expenses], ['Net balance', balance],
            [], ['Date', 'Description', 'Type', 'Amount'],
            ...current.map((item) => [item.date, item.description, displayType(item.type), item.amount]),
        ]
        const csv = rows.map((row) => row.map((value) => escapeCsv(value)).join(',')).join('\r\n')
        const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }))
        const link = document.createElement('a')
        link.href = url; link.download = `ledgerly-expenses-${month}.csv`; link.click(); URL.revokeObjectURL(url)
    }

    function openNew() { setEditing(null); setShowForm(true) }

    return <div className="app-shell">
        <aside className="sidebar"><div className="brand"><div className="brand-mark"><WalletCards size={20} /></div><span>ledgerly</span></div><p className="eyebrow">YOUR MONEY, CLEARLY</p><div className="nav-item active"><Receipt size={18} />Expenses</div><div className="sidebar-note"><PiggyBank size={22} /><strong>Keep it simple.</strong><span>Small habits add up.</span></div><div className="sidebar-footer">Personal workspace<br /><span>{monthLabel(month)}</span></div></aside>
        <main className="main-content"><header className="topbar"><div><p className="breadcrumb">Workspace / Expenses</p><h1>Good morning, Santhosh.</h1></div><div className="avatar">S</div></header>
            <div className="page">{apiError && <div className="api-notice">{apiError}</div>}<div className="page-heading"><div><p className="section-kicker">MONTHLY SNAPSHOT</p><h2>Expenses</h2></div><div className="heading-controls"><label className="month-picker"><CalendarDays size={16} /><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><button className="secondary-button" onClick={exportMonth} disabled={loading} title="Download selected month as CSV"><Download size={16} />Export</button><button className="primary-button" onClick={openNew}><Plus size={17} />Add transaction</button></div></div>
                <section className="summary-grid"><Card label="Total income" value={summary.income} icon={<ArrowUpRight />} tone="green" /><Card label="Savings" value={summary.savings} icon={<PiggyBank />} tone="yellow" /><Card label="Other expenses" value={summary.expenses} icon={<Receipt />} tone="coral" /><Card label="Net balance" value={balance} icon={<WalletCards />} tone="blue" /></section>
                <div className="content-grid"><section className="panel transactions-panel"><div className="panel-heading"><div><h3>{monthLabel(month)} transactions</h3><p>{loading ? 'Loading from expense-manager-mt...' : `${current.length} entries this month`}</p></div><button className="icon-button" onClick={openNew} aria-label="Add transaction"><CirclePlus size={20} /></button></div><div className="transaction-list">{current.length ? current.map((item) => <Row key={item.id} item={item} edit={() => { setEditing(item); setShowForm(true) }} remove={() => remove(item)} />) : <div className="empty-state">{loading ? 'Loading transactions...' : 'No transactions for this month yet.'}</div>}</div></section>
                    <section className="panel monthly-panel"><div className="panel-heading"><div><h3>Monthly history</h3><p>Select a month to inspect it</p></div></div><div className="history-list">{history.map((key) => <button className={key === month ? 'history-row current' : 'history-row'} key={key} onClick={() => setMonth(key)}><span><strong>{monthLabel(key)}</strong><small>{key === month ? 'Selected month' : 'View transactions'}</small></span><span className="history-amount"><strong>{money(getBalance(key, transactions))}</strong><small>balance</small></span></button>)}</div></section></div><p className="helper-copy"><span className="dot"></span>Savings are set aside or invested. Other expenses are money spent day to day.</p>
            </div>
        </main>
        {showForm && <Modal title={editing ? 'Edit transaction' : 'Add transaction'} close={() => setShowForm(false)}><form className="form" onSubmit={save}><label>Date<input name="date" type="date" defaultValue={editing?.date || today} required /></label><label>Description<input name="description" placeholder="e.g. Salary, Grocery" defaultValue={editing?.description || ''} required /></label><label>Amount<input name="amount" type="number" min="1" step="1" placeholder="0" defaultValue={editing?.amount || ''} required /></label><label>Type<select name="type" defaultValue={editing?.type || 'expense'}><option value="income">Income</option><option value="savings">Savings</option><option value="expense">Other expense</option></select></label><button className="primary-button submit-button" type="submit">{editing ? 'Save changes' : 'Add transaction'}</button></form></Modal>}
    </div>
}

function normalize(item: ApiTransaction): Transaction { return { id: item.id, date: item.transactionDate, description: item.description, amount: Number(item.amount), type: item.transactionType } }
function total(items: Transaction[], type: TransactionType) { return items.filter((item) => item.type === type).reduce((sum, item) => sum + item.amount, 0) }
function getBalance(month: string, transactions: Transaction[]) { return transactions.filter((item) => item.date.startsWith(month)).reduce((balance, item) => balance + (item.type === 'income' ? item.amount : -item.amount), 0) }
function displayType(type: TransactionType) { return type === 'income' ? 'Income' : type === 'savings' ? 'Savings' : 'Other expense' }
function Card({ label, value, icon, tone }: { label: string; value: number; icon: ReactNode; tone: string }) { return <div className="summary-card"><div className={`summary-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{money(value)}</strong></div></div> }
function Row({ item, edit, remove }: { item: Transaction; edit: () => void; remove: () => void }) { return <div className="transaction-row"><div className={`transaction-symbol ${item.type}`}>{item.type === 'income' ? <ArrowUpRight size={18} /> : item.type === 'savings' ? <PiggyBank size={17} /> : <Receipt size={17} />}</div><div className="transaction-info"><strong>{item.description}</strong><span>{new Date(`${item.date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} <i>·</i> {displayType(item.type)}</span></div><strong className={item.type === 'income' ? 'amount positive' : 'amount'}>{item.type === 'income' ? '+' : '-'}{money(item.amount)}</strong><div className="row-actions"><button onClick={edit} aria-label={`Edit ${item.description}`}><Pencil size={15} /></button><button onClick={remove} aria-label={`Delete ${item.description}`}><Trash2 size={15} /></button></div></div> }
function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) { return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><div className="modal"><div className="modal-heading"><h3>{title}</h3><button className="icon-button" onClick={close} aria-label="Close"><X size={19} /></button></div>{children}</div></div> }
