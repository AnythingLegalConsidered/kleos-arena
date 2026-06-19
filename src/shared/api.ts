export type InitResponse = {
  type: "init";
  postId: string;
  count: number;
  username: string;
};

export type IncrementResponse = {
  type: "increment";
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: "decrement";
  postId: string;
  count: number;
};

// --- stable (Phase 3) ---

import type { AttributeKey, Stable } from "./stable";

/** Current player's stable, as returned by GET /api/stable. */
export type StableResponse = {
  type: "stable";
  stable: Stable;
};

/** A spend the client asks the authoritative server to apply. */
export type StableAction =
  | { action: "attr"; gladiatorId: string; attr: AttributeKey }
  | { action: "perk"; gladiatorId: string; attr: AttributeKey }
  | { action: "heal"; gladiatorId: string };

/** Result of POST /api/stable/action: the updated stable, or a rejection. */
export type StableActionResponse =
  | { type: "stable"; stable: Stable }
  | { type: "error"; error: string };
