import axios from "axios";
import { logger } from "./logger";
import type { User } from "@workspace/db";

/**
 * Stripe Issuing integration — the complete card-issuance path.
 * Everything is wired; it activates the moment STRIPE_SECRET_KEY is set on
 * Render AND an admin flips the card program switch in /admin/settings.
 *
 * Card *authorization/transaction* events arrive via the existing
 * /webhooks/stripe endpoint (set STRIPE_WEBHOOK_SECRET).
 */

const STRIPE_API = "https://api.stripe.com/v1";

// Virtual-card programs bill to the program (company) address, configurable per deployment.
const PROGRAM_ADDRESS = {
  line1: process.env.CARD_PROGRAM_ADDRESS_LINE1 ?? "2261 Market Street",
  city: process.env.CARD_PROGRAM_ADDRESS_CITY ?? "San Francisco",
  state: process.env.CARD_PROGRAM_ADDRESS_STATE ?? "CA",
  postal_code: process.env.CARD_PROGRAM_ADDRESS_POSTAL ?? "94114",
  country: process.env.CARD_PROGRAM_ADDRESS_COUNTRY ?? "US",
};

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function stripeClient() {
  return axios.create({
    baseURL: STRIPE_API,
    timeout: 15000,
    auth: { username: process.env.STRIPE_SECRET_KEY ?? "", password: "" },
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}

export interface IssuedCard {
  cardholderId: string;
  cardId: string;
  last4: string;
  expMonth: number;
  expYear: number;
  brand: "visa" | "mastercard";
  status: "active" | "locked" | "cancelled";
}

/** Create a Stripe Issuing cardholder + virtual card for the user. */
export async function issueVirtualCard(user: Pick<User, "id" | "email" | "fullName" | "phoneNumber" | "stripeCardholderId">): Promise<IssuedCard> {
  const stripe = stripeClient();

  let cardholderId = user.stripeCardholderId;
  if (!cardholderId) {
    const cardholder = await stripe.post("/issuing/cardholders", new URLSearchParams({
      type: "individual",
      name: user.fullName,
      email: user.email,
      ...(user.phoneNumber ? { phone_number: user.phoneNumber } : {}),
      "billing[address][line1]": PROGRAM_ADDRESS.line1,
      "billing[address][city]": PROGRAM_ADDRESS.city,
      "billing[address][state]": PROGRAM_ADDRESS.state,
      "billing[address][postal_code]": PROGRAM_ADDRESS.postal_code,
      "billing[address][country]": PROGRAM_ADDRESS.country,
      "metadata[spay_user_id]": user.id,
    }));
    cardholderId = cardholder.data.id as string;
  }

  const card = await stripe.post("/issuing/cards", new URLSearchParams({
    cardholder: cardholderId,
    currency: "usd",
    type: "virtual",
    status: "active",
    "metadata[spay_user_id]": user.id,
  }));

  logger.info({ userId: user.id, cardId: card.data.id }, "Virtual card issued via Stripe");

  return {
    cardholderId,
    cardId: card.data.id,
    last4: card.data.last4,
    expMonth: card.data.exp_month,
    expYear: card.data.exp_year,
    brand: card.data.brand?.toLowerCase() === "mastercard" ? "mastercard" : "visa",
    status: "active",
  };
}

/** Freeze / unfreeze a card. Stripe's "inactive" = frozen (declines all auths). */
export async function setCardStatus(cardId: string, status: "active" | "inactive"): Promise<void> {
  await stripeClient().post(`/issuing/cards/${cardId}`, new URLSearchParams({ status }));
  logger.info({ cardId, status }, "Card status changed");
}

/**
 * Set (or clear) a monthly spending limit. Stripe spending_controls amounts are
 * integer cents; 0 clears the limit entirely.
 */
export async function setCardSpendingLimit(cardId: string, monthlyUsd: number): Promise<void> {
  const params = new URLSearchParams();
  if (monthlyUsd > 0) {
    params.set("spending_controls[spending_limits][0][amount]", String(Math.round(monthlyUsd * 100)));
    params.set("spending_controls[spending_limits][0][interval]", "monthly");
  } else {
    // Clearing: send an empty spending_limits array
    params.set("spending_controls[spending_limits]", "");
  }
  await stripeClient().post(`/issuing/cards/${cardId}`, params);
  logger.info({ cardId, monthlyUsd }, "Card spending limit updated");
}

/**
 * Real-time authorization decision. Stripe holds the merchant's request open
 * for ~2 seconds waiting for this call — the webhook handler must decide fast
 * (one balance read) and answer immediately.
 */
export async function approveAuthorization(authId: string): Promise<void> {
  await stripeClient().post(`/issuing/authorizations/${authId}/approve`);
}

export async function declineAuthorization(authId: string): Promise<void> {
  await stripeClient().post(`/issuing/authorizations/${authId}/decline`);
}

/** Fetch a live summary of an issued card (masked — full PAN stays inside Stripe). */
export async function fetchCardSummary(cardId: string): Promise<Omit<IssuedCard, "cardholderId"> | null> {
  try {
    const res = await stripeClient().get(`/issuing/cards/${cardId}`);
    const c = res.data;
    return {
      cardId: c.id,
      last4: c.last4,
      expMonth: c.exp_month,
      expYear: c.exp_year,
      brand: c.brand?.toLowerCase() === "mastercard" ? "mastercard" : "visa",
      status: c.status === "canceled" ? "cancelled" : c.status === "inactive" ? "locked" : "active",
    };
  } catch (err) {
    logger.warn({ err, cardId }, "Failed to fetch card from Stripe");
    return null;
  }
}
