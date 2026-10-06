// Shared types for the Gesture Deck.
// Cards are assembled READ-ONLY from existing app state via the same server
// functions the chat and other pages use. No new backend endpoints.

export type DeckCardKind = "approval" | "mission" | "routine" | "device";

export interface DeckCardDetail {
  label: string;
  value: string;
}

/** Device kinds accepted by the existing sendDeviceCommand server function. */
export type DeviceCommandKind = "shell" | "open" | "notify" | "say" | "script" | "vibrate";

export interface DeckCardData {
  /** Stable id: `<kind>:<source-id>[:<index>]`. */
  id: string;
  kind: DeckCardKind;
  title: string;
  subtitle: string;
  meta: string;
  details: DeckCardDetail[];
  /**
   * Present only on approval cards. Approving calls the existing
   * sendDeviceCommand server function with exactly this kind/command —
   * the same action the chat takes when the user says "do 1 and 3".
   */
  approve?: {
    kind: DeviceCommandKind;
    command: string;
  };
}

export const DECK_ORDER_KEY = "gesture-deck-order-v1";
export const DECK_DISMISSED_KEY = "gesture-deck-dismissed-v1";

/** Load a JSON value from localStorage, falling back safely on any error. */
export function loadDeckState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveDeckState(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — deck still works for the session
  }
}

/**
 * Order cards by a saved id list; cards missing from the list keep their
 * relative order at the end. Dismissed ids are filtered out.
 */
export function applyDeckOrder(cards: DeckCardData[], order: string[], dismissed: string[]): DeckCardData[] {
  const dismissedSet = new Set(dismissed);
  const visible = cards.filter((c) => !dismissedSet.has(c.id));
  const rank = new Map(order.map((id, i) => [id, i] as const));
  return [...visible].sort((a, b) => {
    const ra = rank.get(a.id);
    const rb = rank.get(b.id);
    if (ra === undefined && rb === undefined) return 0;
    if (ra === undefined) return 1;
    if (rb === undefined) return -1;
    return ra - rb;
  });
}
