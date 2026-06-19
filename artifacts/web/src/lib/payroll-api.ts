import { getToken } from "@/lib/auth";

// Thin typed fetch wrapper for the payroll/employer endpoints. The consumer
// app's generated hooks cover user flows; the employer portal is a smaller,
// owner-only console, so a focused wrapper keeps it self-contained.

const API_BASE = `${import.meta.env.VITE_API_URL ?? ""}/api`;

export class PayrollApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new PayrollApiError(res.status, data.error ?? "error", data.message ?? "Request failed");
  }
  return data as T;
}

// ── Types (mirror the API responses) ────────────────────────────────────────────

export interface Employer {
  id: string;
  companyName: string;
  email: string;
  websiteUrl: string | null;
  country: string | null;
  status: "pending" | "verified" | "rejected" | "suspended";
  balanceUsdc: number;
  fundingAddress: string | null;
  webhookUrl: string | null;
  autoCreateWorkers: boolean;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string | null;
  prefix: string;
  sandbox: boolean;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface Batch {
  id: string;
  reference: string | null;
  description: string | null;
  sandbox: boolean;
  currency: string;
  status: "draft" | "processing" | "completed" | "partially_completed" | "failed" | "cancelled";
  totalAmount: number;
  feeAmount: number;
  totalCost: number;
  paymentCount: number;
  completedCount: number;
  failedCount: number;
  webhookUrl: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  workerIdentifier: string;
  identifierType: string;
  amount: number;
  currency: string;
  reason: string | null;
  status: "pending" | "resolved" | "completed" | "failed";
  workerCreated: boolean;
  transactionId: string | null;
  errorMessage: string | null;
  externalId: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface Summary {
  balanceUsdc: number;
  totalBatches: number;
  totalDisbursed: number;
  totalFees: number;
  totalPayments: number;
  completedPayments: number;
  failedPayments: number;
  workersOnboarded: number;
}

// ── Endpoints (owner-authenticated via JWT) ─────────────────────────────────────

export const payrollApi = {
  getEmployer: () => request<{ employer: Employer }>("/payroll/employers/me"),

  register: (body: { companyName: string; email?: string; websiteUrl?: string; country?: string; webhookUrl?: string }) =>
    request<{ employer: Employer; webhookSecret: string }>("/payroll/employers/register", {
      method: "POST", body: JSON.stringify(body),
    }),

  updateEmployer: (body: Partial<Pick<Employer, "companyName" | "email" | "websiteUrl" | "country" | "webhookUrl" | "autoCreateWorkers">>) =>
    request<{ employer: Employer }>("/payroll/employers/me", { method: "PATCH", body: JSON.stringify(body) }),

  getSummary: () => request<Summary>("/payroll/dashboard/summary"),

  listKeys: () => request<{ apiKeys: ApiKey[] }>("/payroll/employers/me/api-keys"),

  createKey: (body: { name?: string; sandbox: boolean }) =>
    request<{ apiKey: string; id: string; name: string; prefix: string; sandbox: boolean }>(
      "/payroll/employers/me/api-keys", { method: "POST", body: JSON.stringify(body) },
    ),

  revokeKey: (id: string) =>
    request<{ revoked: boolean }>(`/payroll/employers/me/api-keys/${id}`, { method: "DELETE" }),

  listBatches: () => request<{ batches: Batch[]; total: number }>("/payroll/dashboard/batches"),

  getBatch: (id: string) =>
    request<{ batch: Batch; payments: Payment[] }>(`/payroll/dashboard/batches/${id}`),
};
