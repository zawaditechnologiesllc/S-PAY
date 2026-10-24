import { pgTable, text, integer, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

// ── S-PAY Score (personal + business) ──────────────────────────────────────────
// A 300–850 financial-reliability score computed from a member's OWN S-PAY
// activity (verification, payment behaviour, income, history, balance health).
// The model itself lives in @workspace/score-model; these tables are the data
// trail behind it:
//
//   score_profiles   — one row per member: current score + the member's choices
//                      (score on/off, partner-sharing consent).
//   score_snapshots  — one row per member per calendar month: the score, its
//                      factor breakdown and the aggregate signals it was computed
//                      from, stamped with the model version. This is the long-run
//                      history that — only with the member's separate opt-in —
//                      licensed financial institutions may use from ~2031.
//   score_consent_log — append-only audit trail of every consent/control change.
//   score_shares     — member-issued, expiring "proof of score" links.
//
// Aggregates only: snapshots never copy individual transactions, counterparties
// or documents.

export const scoreProfilesTable = pgTable("score_profiles", {
  userId: text("user_id").primaryKey(),
  enabled: boolean("enabled").default(true).notNull(),                // member can turn the score off (stops collection)
  partnerSharingConsent: boolean("partner_sharing_consent").default(false).notNull(), // OFF by default — explicit opt-in only
  partnerSharingConsentAt: timestamp("partner_sharing_consent_at"),
  consentVersion: text("consent_version"),                              // version of the Score Data Notice last accepted
  lastScore: integer("last_score"),
  lastBand: text("last_band"),
  accountType: text("account_type"),                                    // personal | business at the last computation
  modelVersion: text("model_version"),
  lastComputedAt: timestamp("last_computed_at"),
  // Weekly partner-sharing reminder (only for members who haven't opted in):
  // when it was last shown, how many times, and whether they said "don't ask again".
  sharingPromptLastShownAt: timestamp("sharing_prompt_last_shown_at"),
  sharingPromptCount: integer("sharing_prompt_count").default(0).notNull(),
  sharingPromptOptedOut: boolean("sharing_prompt_opted_out").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_score_profiles_last_score").on(t.lastScore),             // percentile + admin distribution
  index("idx_score_profiles_computed").on(t.lastComputedAt),          // background refresh sweep
]).enableRLS();

export const scoreSnapshotsTable = pgTable("score_snapshots", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  period: text("period").notNull(),                                     // calendar month, "YYYY-MM"
  score: integer("score").notNull(),
  band: text("band").notNull(),
  accountType: text("account_type").notNull(),
  modelVersion: text("model_version").notNull(),
  factors: jsonb("factors").notNull(),                                  // per-factor 0–100 values + weights
  signals: jsonb("signals").notNull(),                                  // aggregate inputs (counts/sums) — explainability
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("idx_score_snapshots_user_period").on(t.userId, t.period), // one snapshot per member per month
  index("idx_score_snapshots_period").on(t.period),
]).enableRLS();

export const scoreConsentLogTable = pgTable("score_consent_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  // score_enabled | score_disabled | sharing_granted | sharing_revoked | history_deleted | shares_revoked
  // | sharing_prompt_never ("Don't ask me again" on the weekly reminder)
  action: text("action").notNull(),
  consentVersion: text("consent_version").notNull(),
  source: text("source"),                                               // where the change was made: settings | prompt
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_score_consent_user_created").on(t.userId, t.createdAt.desc()),
  index("idx_score_consent_created").on(t.createdAt.desc()),
]).enableRLS();

export const scoreSharesTable = pgTable("score_shares", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),                              // sha256(token) — the link token itself is never stored
  showExactScore: boolean("show_exact_score").default(false).notNull(), // false = band only
  score: integer("score").notNull(),                                    // frozen at issue time
  band: text("band").notNull(),
  accountType: text("account_type").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  viewCount: integer("view_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("idx_score_shares_token").on(t.tokenHash),
  index("idx_score_shares_user").on(t.userId),
]).enableRLS();

export type ScoreProfile = typeof scoreProfilesTable.$inferSelect;
export type ScoreSnapshot = typeof scoreSnapshotsTable.$inferSelect;
export type ScoreConsentLog = typeof scoreConsentLogTable.$inferSelect;
export type ScoreShare = typeof scoreSharesTable.$inferSelect;
