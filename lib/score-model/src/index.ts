// S-PAY Score — the single source of truth for the scoring model AND the
// customer-facing explanation of it. The API computes scores with model.ts; the
// web app, mobile app and the server-rendered /score page all render the same
// weights, bands, tips and FAQs from content.ts, so what customers read is
// exactly what the engine does.
export * from "./model";
export * from "./content";
