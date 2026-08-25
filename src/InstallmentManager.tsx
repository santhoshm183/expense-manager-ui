import { FormEvent, useEffect, useState } from "react";
import { CalendarPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "./InstallmentModal";

type Chit = { id: string; name: string };
type Member = { id: string; name: string; chit?: { id: string; name: string } };
type Installment = { id: string; chitId: string; chitName: string; memberId: string; memberName: string; numberOfHand: number; installmentAmount: number; installmentDate: string };

const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

export default function InstallmentManager() {
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
    const [chits, setChits] = useState<Chit[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [installments, setInstallments] = useState<Installment[]>([]);
    const [chitId, setChitId] = useState("all");
    const [memberId, setMemberId] = useState("all");
    const [formChitId, setFormChitId] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingInstallment, setEditingInstallment] = useState<Installment | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        Promise.all([fetch(`${baseUrl}/chits`), fetch(`${baseUrl}/members`)]).then(async ([chitsResponse, membersResponse]) => {
            if (!chitsResponse.ok || !membersResponse.ok) throw new Error();
            setChits(await chitsResponse.json());
            setMembers(await membersResponse.json());
        }).catch(() => setError("Could not load chit members."));
    }, []);
    useEffect(() => {
        const params = new URLSearchParams();
        if (chitId !== "all") params.set("chitId", chitId);
        if (memberId !== "all") params.set("memberId", memberId);
        fetch(`${baseUrl}/installments?${params}`).then((response) => { if (!response.ok) throw new Error(); return response.json(); }).then(setInstallments).catch(() => setError("Could not load installments."));
    }, [chitId, memberId]);
    const visibleMembers = chitId === "all" ? members : members.filter((member) => member.chit?.id === chitId);
    const formMembers = formChitId ? members.filter((member) => member.chit?.id === formChitId) : [];
    async function addInstallment(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        const response = await fetch(editingInstallment ? `${baseUrl}/installments/${editingInstallment.id}` : `${baseUrl}/installments`, { method: editingInstallment ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chitId: data.chitId, memberId: data.memberId, numberOfHand: Number(data.numberOfHand), installmentAmount: Number(data.installmentAmount), installmentDate: data.installmentDate }) });
        if (!response.ok) { setError("The installment could not be added."); return; }
        const created = await response.json() as Installment;
        setInstallments((items) => editingInstallment ? items.map((item) => item.id === created.id ? created : item) : [created, ...items]);
        setShowForm(false);
        setEditingInstallment(null);
        setError("");
    }
    async function deleteInstallment(installment: Installment) {
        if (!window.confirm(`Delete installment for ${installment.memberName}?`)) return;
        const response = await fetch(`${baseUrl}/installments/${installment.id}`, { method: "DELETE" });
        if (!response.ok) { setError("The installment could not be deleted."); return; }
        setInstallments((items) => items.filter((item) => item.id !== installment.id));
    }
    return <>
        {error && <div className="api-notice">{error}</div>}
        <div className="page-heading"><div><p className="section-kicker">PAYMENT HISTORY</p><h2>Installment Tracker</h2></div><button className="primary-button" onClick={() => { setEditingInstallment(null); setFormChitId(chitId === "all" ? "" : chitId); setShowForm(true); }}><Plus size={17} />Add installment</button></div>
        <section className="panel installments-panel"><div className="panel-heading"><div><h3>All installments</h3><p>{installments.length} payments shown</p></div><div className="installment-filters"><label>Chit<select value={chitId} onChange={(event) => { setChitId(event.target.value); setMemberId("all"); }}><option value="all">All chits</option>{chits.map((chit) => <option value={chit.id} key={chit.id}>{chit.name}</option>)}</select></label><label>Member<select value={memberId} onChange={(event) => setMemberId(event.target.value)}><option value="all">All members</option>{visibleMembers.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></label></div></div>{installments.length ? installments.map((installment) => <div className="installment-row" key={installment.id}><div className="installment-icon"><CalendarPlus size={17} /></div><div><strong>{installment.memberName}</strong><span>{installment.chitName} · Hand {installment.numberOfHand} · {installment.installmentDate}</span></div><strong className="amount positive">{money(installment.installmentAmount)}</strong><div className="row-actions"><button onClick={() => { setEditingInstallment(installment); setFormChitId(installment.chitId); setShowForm(true); }} aria-label="Edit installment"><Pencil size={14} /></button><button onClick={() => deleteInstallment(installment)} aria-label="Delete installment"><Trash2 size={14} /></button></div></div>) : <div className="empty-state">No installments found for the selected filters.</div>}</section>
        {showForm && <Modal title={editingInstallment ? "Edit installment" : "Add installment"} close={() => { setShowForm(false); setEditingInstallment(null); }}><form className="form" onSubmit={addInstallment}><label>Chit name<select name="chitId" value={formChitId} onChange={(event) => setFormChitId(event.target.value)} required><option value="" disabled>Select a chit</option>{chits.map((chit) => <option value={chit.id} key={chit.id}>{chit.name}</option>)}</select></label><label>Member name<select name="memberId" defaultValue={editingInstallment?.memberId || ""} required disabled={!formChitId}><option value="" disabled>Select a member</option>{formMembers.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select>{formChitId && !formMembers.length && <small className="field-hint">No members are assigned to this chit yet.</small>}</label><label>Number of hand<input name="numberOfHand" type="number" min="1" defaultValue={editingInstallment?.numberOfHand || 1} required /></label><label>Installment amount<input name="installmentAmount" type="number" min="0.01" step="0.01" defaultValue={editingInstallment?.installmentAmount || ""} required /></label><label>Installment date<input name="installmentDate" type="date" defaultValue={editingInstallment?.installmentDate || ""} required /></label><button className="primary-button submit-button" type="submit" disabled={!formMembers.length}>{editingInstallment ? "Save changes" : "Add installment"}</button></form></Modal>}
    </>;
}
