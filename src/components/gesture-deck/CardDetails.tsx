// Details panel for the selected card.
// Approval cards get an approve zone: pinching (or double-pinching) on it
// runs the action through the existing sendDeviceCommand server function —
// the same call the chat makes on "do 1 and 3". The full command is shown
// BEFORE the approve zone so approval is never blind.
import { Check, X } from "lucide-react";
import type { DeckCardData } from "./deck-types";

interface CardDetailsProps {
  card: DeckCardData;
  approving: boolean;
  onApprove: () => void;
  onDismiss: () => void;
  onClose: () => void;
}

export function CardDetails({ card, approving, onApprove, onDismiss, onClose }: CardDetailsProps) {
  return (
    <aside className="gd-details" data-kind={card.kind} aria-label="Card details">
      <div className="gd-details-glow" aria-hidden="true" />
      <header className="gd-details-head">
        <h2>{card.title}</h2>
        <button type="button" className="gd-icon-btn" onClick={onClose} aria-label="Close details">
          <X size={16} />
        </button>
      </header>
      <p className="gd-details-sub">
        {card.subtitle} · {card.meta}
      </p>
      <dl className="gd-details-list">
        {card.details.map((d) => (
          <div key={d.label} className="gd-details-row">
            <dt>{d.label}</dt>
            <dd className={d.label === "Command" ? "gd-command" : undefined}>{d.value}</dd>
          </div>
        ))}
      </dl>
      <div className="gd-details-actions">
        {card.approve ? (
          <button
            type="button"
            className="gd-approve-zone"
            data-approve-zone={card.id}
            onClick={onApprove}
            disabled={approving}
            aria-label={`Approve: ${card.title}`}
          >
            <span className="gd-approve-ring" aria-hidden="true" />
            <Check size={20} />
            <span>{approving ? "Sending…" : "Pinch here to approve"}</span>
          </button>
        ) : null}
        <div className="gd-details-row-actions">
          <button type="button" className="gd-btn gd-btn-ghost" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
      <p className="gd-details-hint">
        {card.approve
          ? "Pinch the approve ring (or double-pinch the card) to run this on your paired device."
          : "Swipe left to dismiss · pinch-hold and move to reorder · open palm to close."}
      </p>
    </aside>
  );
}
