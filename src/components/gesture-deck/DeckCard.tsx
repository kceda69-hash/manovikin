// One holographic task card. Presentational; hit-testing is done by the
// page via data-card-id, and drag offset is applied through CSS variables.
import { Bell, CheckCircle2, Cpu, CalendarClock, Zap } from "lucide-react";
import type { DeckCardData, DeckCardKind } from "./deck-types";

const KIND_ICON: Record<DeckCardKind, typeof Zap> = {
  approval: CheckCircle2,
  mission: Cpu,
  routine: CalendarClock,
  device: Bell,
};

const KIND_LABEL: Record<DeckCardKind, string> = {
  approval: "Approval",
  mission: "Mission",
  routine: "Routine",
  device: "Device",
};

interface DeckCardProps {
  card: DeckCardData;
  selected: boolean;
  dragOffset?: { x: number; y: number } | null;
}

export function DeckCard({ card, selected, dragOffset }: DeckCardProps) {
  const Icon = KIND_ICON[card.kind];
  const style =
    dragOffset != null
      ? ({ "--gd-drag-x": `${dragOffset.x}px`, "--gd-drag-y": `${dragOffset.y}px` } as React.CSSProperties)
      : undefined;
  return (
    <article
      className="gd-card"
      data-card-id={card.id}
      data-kind={card.kind}
      data-selected={selected ? "true" : "false"}
      data-dragging={dragOffset != null ? "true" : "false"}
      style={style}
    >
      <div className="gd-card-glow" aria-hidden="true" />
      <header className="gd-card-head">
        <span className="gd-card-kind">
          <Icon size={14} />
          {KIND_LABEL[card.kind]}
        </span>
        {card.kind === "approval" ? <span className="gd-card-pulse">awaiting</span> : null}
      </header>
      <h3 className="gd-card-title">{card.title}</h3>
      <p className="gd-card-sub">{card.subtitle}</p>
      <p className="gd-card-meta">{card.meta}</p>
    </article>
  );
}
