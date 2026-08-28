import { ReactNode } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
    return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><div className="modal"><div className="modal-heading"><h3>{title}</h3><button className="icon-button" onClick={close} aria-label="Close"><X size={19} /></button></div>{children}</div></div>;
}

export function FeedbackPopup({ message, type, close }: { message: string; type: "error" | "success"; close: () => void }) {
    const isError = type === "error";
    return (
        <div className="feedback-backdrop" role="presentation">
            <div className={`feedback-popup ${type}`} role="alertdialog" aria-modal="true" aria-labelledby="feedback-title">
                <div className="feedback-icon">
                    {isError ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
                </div>
                <div className="feedback-content">
                    <h3 id="feedback-title">{isError ? "Something went wrong" : "Success"}</h3>
                    <p>{message}</p>
                </div>
                <button className="primary-button feedback-ok" onClick={close}>OK</button>
            </div>
        </div>
    );
}
