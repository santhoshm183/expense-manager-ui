import { FormEvent, useEffect, useState } from "react";
import { CalendarPlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { FeedbackPopup, Modal } from "./InstallmentModal";

type Chit = { id: string; name: string };
type Member = { id: string; name: string; chit?: { id: string; name: string } };
type Installment = { id: string; chitId: string; chitName: string; memberId: string; memberName: string; numberOfHand: number; installmentAmount: number; installmentDate: string };

const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

export default function InstallmentManager({ initialChitId }: { initialChitId: string }) {
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
    const [chits, setChits] = useState<Chit[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [installments, setInstallments] = useState<Installment[]>([]);
    const [chitId, setChitId] = useState(initialChitId);
    const [memberId, setMemberId] = useState("all");
    const [hand, setHand] = useState("all");
    const [formChitId, setFormChitId] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [showBulkForm, setShowBulkForm] = useState(false);
    const [editingInstallment, setEditingInstallment] = useState<Installment | null>(null);
    const [nextHand, setNextHand] = useState(1);
    const [bulkChitId, setBulkChitId] = useState("");
    const [bulkMemberIds, setBulkMemberIds] = useState<string[]>([]);
    const [bulkAllMembers, setBulkAllMembers] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    useEffect(() => { if (initialChitId) { setChitId(initialChitId); setMemberId("all"); } }, [initialChitId]);

    useEffect(() => {
        Promise.all([fetch(`${baseUrl}/chits`), fetch(`${baseUrl}/members`)]).then(async ([chitsResponse, membersResponse]) => {
            if (!chitsResponse.ok || !membersResponse.ok) throw new Error();
            setChits(await chitsResponse.json());
            setMembers(await membersResponse.json());
        }).catch(() => setError("Could not load chit members."));
    }, []);
    useEffect(() => {
        const params = new URLSearchParams();
        if (chitId && chitId !== "all") params.set("chitId", chitId);
        if (memberId !== "all") params.set("memberId", memberId);
        if (hand !== "all") params.set("hand", hand);
        fetch(`${baseUrl}/installments?${params}`).then((response) => { if (!response.ok) throw new Error(); return response.json(); }).then(setInstallments).catch(() => setError("Could not load installments."));
    }, [chitId, memberId, hand]);
    const visibleMembers = chitId === "all" ? members : members.filter((member) => member.chit?.id === chitId);
    const formMembers = formChitId ? members.filter((member) => member.chit?.id === formChitId) : [];
    useEffect(() => {
        if (!showBulkForm || !bulkChitId) return;
        fetch(`${baseUrl}/installments/next-hand-by-chit?chitId=${bulkChitId}`)
            .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
            .then((data: { numberOfHand: number }) => setNextHand(data.numberOfHand))
            .catch(() => setError("Could not load the next installment hand."));
    }, [showBulkForm, bulkChitId, baseUrl]);
    async function addInstallment(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        const response = await fetch(editingInstallment ? `${baseUrl}/installments/${editingInstallment.id}` : `${baseUrl}/installments`, { method: editingInstallment ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chitId: data.chitId, memberId: data.memberId, numberOfHand: Number(data.numberOfHand), installmentAmount: Number(data.installmentAmount), installmentDate: data.installmentDate }) });
        if (!response.ok) {
            let message = "Something went wrong. Please try again.";
            try { const body = await response.json(); if (typeof body.message === "string") message = body.message; } catch { /* common error */ }
            setError(message);
            return;
        }
        const created = await response.json() as Installment;
        setInstallments((items) => editingInstallment ? items.map((item) => item.id === created.id ? created : item) : [created, ...items]);
        window.dispatchEvent(new Event("installment-changed"));
        setShowForm(false);
        setEditingInstallment(null);
        setError("");
        setSuccess(editingInstallment ? "Installment updated successfully." : "Installment created successfully.");
    }
    async function deleteInstallment(installment: Installment) {
        if (!window.confirm(`Delete installment for ${installment.memberName}?`)) return;
        const response = await fetch(`${baseUrl}/installments/${installment.id}`, { method: "DELETE" });
        if (!response.ok) { setError("Something went wrong. Please try again."); return; }
        setInstallments((items) => items.filter((item) => item.id !== installment.id));
        window.dispatchEvent(new Event("installment-changed"));
        setSuccess("Installment deleted successfully.");
    }
    async function addForAll(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        const response = await fetch(`${baseUrl}/installments/bulk`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chitId: data.chitId,
                memberIds: bulkAllMembers
                    ? members.filter((member) => member.chit?.id === bulkChitId).map((member) => member.id)
                    : bulkMemberIds,
                numberOfHand: Number(data.numberOfHand),
                installmentAmount: Number(data.installmentAmount),
                installmentDate: data.installmentDate,
            }),
        });
        if (!response.ok) {
            let message = "Something went wrong. Please try again.";
            try { const body = await response.json(); if (typeof body.message === "string") message = body.message; } catch { /* common fallback */ }
            setError(message);
            return;
        }
        setShowBulkForm(false);
        setBulkMemberIds([]);
        setBulkAllMembers(false);
        setSuccess("Installments added successfully for the selected members.");
        const refreshed = await fetch(`${baseUrl}/installments?chitId=${chitId === "all" ? "" : chitId}`);
        if (refreshed.ok) setInstallments(await refreshed.json());
        window.dispatchEvent(new Event("installment-changed"));
    }
    return <>
        {error && <FeedbackPopup message={error} type="error" close={() => { setError(""); setSuccess(""); }} />}
        {!error && success && <FeedbackPopup message={success} type="success" close={() => setSuccess("")} />}
        <div className="page-heading"><div><p className="section-kicker">PAYMENT HISTORY</p><h2>Installment Tracker</h2></div><div className="heading-controls"><button className="secondary-button" onClick={() => { setBulkChitId(chitId === "all" ? "" : chitId); setBulkMemberIds([]); setBulkAllMembers(false); setNextHand(1); setShowBulkForm(true); }}><Plus size={17} />Add all</button><button className="primary-button" onClick={() => { setEditingInstallment(null); setNextHand(1); setFormChitId(chitId === "all" ? "" : chitId); setShowForm(true); }}><Plus size={17} />Add installment</button></div></div>
        <section className="panel installments-panel"><div className="panel-heading"><div><h3>All installments</h3><p>{installments.length} payments shown</p></div><div className="installment-filters"><label>Chit<select value={chitId} onChange={(event) => { setChitId(event.target.value); setMemberId("all"); setHand("all"); }}><option value="all">All chits</option>{chits.map((chit) => <option value={chit.id} key={chit.id}>{chit.name}</option>)}</select></label><label>Member<select value={memberId} onChange={(event) => setMemberId(event.target.value)}><option value="all">All members</option>{visibleMembers.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></label><label>Number of hand<select value={hand} onChange={(event) => setHand(event.target.value)}><option value="all">All hands</option>{Array.from(new Set(installments.map((item) => item.numberOfHand))).sort((a, b) => a - b).map((value) => <option value={value} key={value}>Hand {value}</option>)}</select></label></div></div>{installments.length ? installments.map((installment) => <div className="installment-row" key={installment.id}><div className="installment-icon"><CalendarPlus size={17} /></div><div><strong>{installment.memberName}</strong><span>{installment.chitName} · Hand {installment.numberOfHand} · {installment.installmentDate}</span></div><strong className="amount positive">{money(installment.installmentAmount)}</strong><div className="row-actions"><button onClick={() => { setEditingInstallment(installment); setFormChitId(installment.chitId); setShowForm(true); }} aria-label="Edit installment"><Pencil size={14} /></button><button onClick={() => deleteInstallment(installment)} aria-label="Delete installment"><Trash2 size={14} /></button></div></div>) : <div className="empty-state">No installments found for the selected filters.</div>}</section>
        {showForm && <Modal title={editingInstallment ? "Edit installment" : "Add installment"} close={() => { setShowForm(false); setEditingInstallment(null); }}><form className="form" onSubmit={addInstallment}><label>Chit name<select name="chitId" value={formChitId} onChange={(event) => setFormChitId(event.target.value)} required><option value="" disabled>Select a chit</option>{chits.map((chit) => <option value={chit.id} key={chit.id}>{chit.name}</option>)}</select></label><label>Member name<select name="memberId" defaultValue={editingInstallment?.memberId || ""} onChange={(event) => { if (!editingInstallment) { fetch(`${baseUrl}/installments/next-hand?memberId=${event.target.value}`).then((response) => response.json()).then((data: { numberOfHand: number }) => setNextHand(data.numberOfHand)); } }} required disabled={!formChitId}><option value="" disabled>Select a member</option>{formMembers.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select>{formChitId && !formMembers.length && <small className="field-hint">No members are assigned to this chit yet.</small>}</label><label>Number of hand<input name="numberOfHand" type="number" min="1" value={editingInstallment?.numberOfHand || nextHand} onChange={(event) => setNextHand(Number(event.target.value))} required /></label><label>Installment amount<input name="installmentAmount" type="number" min="0.01" step="0.01" defaultValue={editingInstallment?.installmentAmount || ""} required /></label><label>Installment date<input name="installmentDate" type="date" defaultValue={editingInstallment?.installmentDate || ""} required /></label><button className="primary-button submit-button" type="submit" disabled={!formMembers.length}>{editingInstallment ? "Save changes" : "Add installment"}</button></form></Modal>}
        {showBulkForm && <Modal title="Add installments for members" close={() => setShowBulkForm(false)}><form className="form" onSubmit={addForAll}><label>Chit name<select name="chitId" value={bulkChitId} onChange={(event) => { setBulkChitId(event.target.value); setBulkMemberIds([]); setBulkAllMembers(false); }} required><option value="" disabled>Select a chit</option>{chits.map((chit) => <option value={chit.id} key={chit.id}>{chit.name}</option>)}</select></label><label className="toggle-field"><span>All members</span><button type="button" className={bulkAllMembers ? "toggle-button on" : "toggle-button"} onClick={() => { const allSelected = !bulkAllMembers; setBulkAllMembers(allSelected); setBulkMemberIds(allSelected ? members.filter((member) => member.chit?.id === bulkChitId).map((member) => member.id) : []); }} aria-pressed={bulkAllMembers} disabled={!bulkChitId}><span className="toggle-knob" /><strong>{bulkAllMembers ? "YES" : "NO"}</strong></button></label><label>Members<select multiple value={bulkMemberIds} onChange={(event) => { setBulkAllMembers(false); setBulkMemberIds(Array.from(event.target.selectedOptions, (option) => option.value)); }} required disabled={!bulkChitId}>{members.filter((member) => member.chit?.id === bulkChitId).map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select><small className="field-hint">Select members, then remove anyone who should not receive this installment.</small></label>{bulkMemberIds.length > 0 && <div className="selected-member-list">{bulkMemberIds.map((memberId) => { const member = members.find((item) => item.id === memberId); return member ? <div className="selected-member" key={member.id}><span>{member.name}</span><button type="button" onClick={() => { setBulkAllMembers(false); setBulkMemberIds((ids) => ids.filter((id) => id !== member.id)); }} aria-label={`Remove ${member.name}`}><X size={14} /></button></div> : null; })}</div>}<label>Number of hand<input name="numberOfHand" type="number" min="1" value={nextHand} onChange={(event) => setNextHand(Number(event.target.value))} required /></label><label>Installment amount<input name="installmentAmount" type="number" min="0.01" step="0.01" required /></label><label>Installment date<input name="installmentDate" type="date" required /></label><button className="primary-button submit-button" type="submit" disabled={!bulkMemberIds.length}>Add installments</button></form></Modal>}
    </>;
}
