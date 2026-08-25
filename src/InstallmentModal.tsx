import { ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
    return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><div className="modal"><div className="modal-heading"><h3>{title}</h3><button className="icon-button" onClick={close} aria-label="Close"><X size={19} /></button></div>{children}</div></div>;
}
