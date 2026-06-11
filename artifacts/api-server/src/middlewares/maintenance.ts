import { Request, Response, NextFunction } from "express";
import { getMaintenance } from "../lib/settings";

// Paths that must stay reachable during maintenance:
// health/status (monitors), sign-in + admin (so an admin can turn it off),
// and provider webhooks (never drop a KYC or payout event).
const ALLOWED = [
  /^\/healthz/,
  /^\/status/,
  /^\/auth\/login/,
  /^\/auth\/google/,
  /^\/auth\/oauth\//,
  /^\/auth\/me/,
  /^\/webhooks\//,
  /^\/admin\//,
];

export async function maintenanceGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const state = await getMaintenance();
    if (!state.enabled || ALLOWED.some((r) => r.test(req.path))) {
      next();
      return;
    }
    res.status(503).json({ error: "maintenance", message: state.message });
  } catch {
    // Never let the gate itself take the platform down
    next();
  }
}
