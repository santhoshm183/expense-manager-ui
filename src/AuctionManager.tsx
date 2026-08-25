import { FormEvent, useEffect, useState } from "react";
import { Gavel, Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "./InstallmentModal";

type Chit = { id: string; name: string };
type Member = {
    id: string;
    name: string;
    chit?: { id: string; name: string };
    chitTaken?: boolean;
};
type Auction = {
    extraHand: boolean;
    id: string;
    chitId: string;
    chitName: string;
    bidNo: number;
    auctionMonth: string;
    bidAmount: number;
    winningMemberId: string;
    winningMemberName: string;
    netAmountPaid: number;
    agentAmount: number;
    profitAmount: number;
};
const money = (value: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(value);

export default function AuctionManager({ initialChitId }: { initialChitId: string }) {
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
    const [chits, setChits] = useState<Chit[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [auctions, setAuctions] = useState<Auction[]>([]);
    const [chitId, setChitId] = useState(initialChitId);
    const [formChitId, setFormChitId] = useState("");
    const [extraHand, setExtraHand] = useState(false);
    const [editing, setEditing] = useState<Auction | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => { if (initialChitId) setChitId(initialChitId); }, [initialChitId]);
    useEffect(() => {
        Promise.all([fetch(`${baseUrl}/chits`), fetch(`${baseUrl}/members`)])
            .then(async ([chitsResponse, membersResponse]) => {
                if (!chitsResponse.ok || !membersResponse.ok) throw new Error();
                setChits(await chitsResponse.json());
                setMembers(await membersResponse.json());
            })
            .catch(() => setError("Could not load chits and members."));
    }, []);
    useEffect(() => {
        const query = chitId === "all" ? "" : `?chitId=${chitId}`;
        fetch(`${baseUrl}/auctions${query}`)
            .then((response) => {
                if (!response.ok) throw new Error();
                return response.json();
            })
            .then(setAuctions)
            .catch(() => setError("Could not load auctions."));
    }, [chitId]);
    const formMembers = formChitId
        ? members.filter((member) => member.chit?.id === formChitId)
        : [];
    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        const response = await fetch(
            editing ? `${baseUrl}/auctions/${editing.id}` : `${baseUrl}/auctions`,
            {
                method: editing ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chitId: data.chitId,
                    bidNo: Number(data.bidNo),
                    extraHand,
                    auctionMonth: data.auctionMonth,
                    bidAmount: Number(data.bidAmount),
                    winningMemberId: data.winningMemberId,
                }),
            },
        );
        if (!response.ok) {
            setError(
                "The auction could not be saved. Check the bid amount and selected member.",
            );
            return;
        }
        const saved = (await response.json()) as Auction;
        setAuctions((items) =>
            editing
                ? items.map((item) => (item.id === saved.id ? saved : item))
                : [saved, ...items],
        );
        setEditing(null);
        setShowForm(false);
        setError("");
    }
    async function remove(auction: Auction) {
        if (
            !window.confirm(
                `Delete bid #${auction.bidNo} for ${auction.winningMemberName}?`,
            )
        )
            return;
        const response = await fetch(`${baseUrl}/auctions/${auction.id}`, {
            method: "DELETE",
        });
        if (!response.ok) {
            setError("The auction could not be deleted.");
            return;
        }
        setAuctions((items) => items.filter((item) => item.id !== auction.id));
    }
    return (
        <>
            {error && <div className="api-notice">{error}</div>}
            <div className="page-heading">
                <div>
                    <p className="section-kicker">MONTHLY AUCTION SYSTEM</p>
                    <h2>Auctions</h2>
                </div>
                <div className="heading-controls">
                    <label className="member-filter">
                        <span>Chit</span>
                        <select
                            value={chitId}
                            onChange={(event) => setChitId(event.target.value)}
                        >
                            <option value="all">All chits</option>
                            {chits.map((chit) => (
                                <option value={chit.id} key={chit.id}>
                                    {chit.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button
                        className="primary-button"
                        onClick={() => {
                            setEditing(null);
                            setFormChitId(chitId === "all" ? "" : chitId);
                            setExtraHand(false);
                            setShowForm(true);
                        }}
                    >
                        <Plus size={17} />
                        Add auction
                    </button>
                </div>
            </div>
            <section className="panel auction-panel">
                <div className="panel-heading">
                    <div>
                        <h3>Auction history</h3>
                        <p>{auctions.length} auctions shown</p>
                    </div>
                </div>
                {auctions.length ? (
                    auctions.map((auction) => (
                        <div className="auction-row" key={auction.id}>
                            <div className="installment-icon">
                                <Gavel size={17} />
                            </div>
                            <div>
                                <strong>
                                    Bid #{auction.bidNo} · {auction.winningMemberName}
                                </strong>
                                <span>
                                    {auction.chitName} · {auction.auctionMonth}
                                </span>
                            </div>
                            <div className="auction-values">
                                <span>Bid {money(auction.bidAmount)}</span>
                                <span>Net {money(auction.netAmountPaid)}</span>
                                <span>Agent {money(auction.agentAmount)}</span>
                                <strong>Profit {money(auction.profitAmount)}</strong>
                            </div>
                            <span className={auction.extraHand ? "status active" : "status"}>
                                {auction.extraHand ? "Extra hand" : "Regular hand"}
                            </span>
                            <div className="row-actions">
                                <button
                                    onClick={() => {
                                        setEditing(auction);
                                        setFormChitId(auction.chitId);
                                        setExtraHand(auction.extraHand);
                                        setShowForm(true);
                                    }}
                                    aria-label="Edit auction"
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    onClick={() => remove(auction)}
                                    aria-label="Delete auction"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="empty-state">No auctions found for this chit.</div>
                )}
            </section>
            {showForm && (
                <Modal
                    title={editing ? "Edit auction" : "Add auction"}
                    close={() => {
                        setShowForm(false);
                        setEditing(null);
                    }}
                >
                    <form className="form" onSubmit={save}>
                        <label>
                            Chit name
                            <select
                                name="chitId"
                                value={formChitId}
                                onChange={(event) => {
                                    setFormChitId(event.target.value);
                                }}
                                required
                            >
                                <option value="" disabled>
                                    Select a chit
                                </option>
                                {chits.map((chit) => (
                                    <option value={chit.id} key={chit.id}>
                                        {chit.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Bid number
                            <input
                                name="bidNo"
                                type="number"
                                min="1"
                                max="999"
                                defaultValue={editing?.bidNo || ""}
                                required
                            />
                        </label>
                        <label className="toggle-field">
                            Extra hand
                            <button type="button" className={extraHand ? "toggle-button on" : "toggle-button"} onClick={() => setExtraHand((value) => !value)} aria-pressed={extraHand}>
                                <span className="toggle-knob" />
                                <strong>{extraHand ? "ON" : "OFF"}</strong>
                            </button>
                            <input name="extraHand" type="hidden" value={extraHand ? "true" : "false"} />
                        </label>
                        <label>
                            Auction month
                            <input
                                name="auctionMonth"
                                type="date"
                                defaultValue={editing?.auctionMonth || ""}
                                required
                            />
                        </label>
                        <label>
                            Bid amount
                            <input
                                name="bidAmount"
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={editing?.bidAmount || ""}
                                required
                            />
                        </label>
                        <label>
                            Winning member
                            <select
                                name="winningMemberId"
                                defaultValue={editing?.winningMemberId || ""}
                                required
                                disabled={!formChitId}
                            >
                                <option value="" disabled>
                                    Select a member
                                </option>
                                {formMembers.map((member) => (
                                    <option value={member.id} key={member.id}>
                                        {member.name}
                                    </option>
                                ))}
                            </select>
                            {formChitId && !formMembers.length && (
                                <small className="field-hint">
                                    No members are assigned to this chit yet.
                                </small>
                            )}
                        </label>
                        <button
                            className="primary-button submit-button"
                            type="submit"
                            disabled={!formMembers.length}
                        >
                            {editing ? "Save changes" : "Submit auction"}
                        </button>
                    </form>
                </Modal>
            )}
        </>
    );
}
