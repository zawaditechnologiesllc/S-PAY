/**
 * Customer-facing explanation of the S-PAY Score. Rendered by the public /score
 * page (SPA), its server-rendered twin for search engines, the in-app My Score
 * page and the mobile app — one copy, so every surface says the same thing.
 *
 * Honesty rules for this file: anything not live today is labelled "planned";
 * weights come from the model constants, never hand-typed.
 */

import {
  SCORE_BANDS, SCORE_FACTOR_LABELS, SCORE_MAX, SCORE_MIN, SCORE_PARTNER_SHARING_TARGET_YEAR,
  SCORE_TRUSTED_THRESHOLD, SCORE_WEIGHTS, SCORE_EXAMPLE_SIGNALS, computeScore,
  type ScoreAccountType, type ScoreBandKey, type ScoreFactorKey,
} from "./model";

export const SCORE_PRODUCT_NAME = "S-PAY Score";

export const SCORE_TAGLINE = "Built from how you get paid and pay — not from collateral or a credit bureau.";

export const SCORE_INTRO =
  `S-PAY Score is a free ${SCORE_MIN}–${SCORE_MAX} score that shows how reliable your money life on S-PAY is. ` +
  "It's built only from your own S-PAY activity — verification, payments, income and history — and comes with a " +
  "personal plan to raise it. Every personal and business account has one. It never costs anything, checking it never " +
  "lowers it, and it's never used to freeze or hold back your own money.";

/** The worked example from model.ts, described for marketing pages — its score is computed, never typed in. */
export const SCORE_EXAMPLE = {
  score: computeScore(SCORE_EXAMPLE_SIGNALS).score,
  description: "Verified, paid every month by two clients, clean payments and a 10% buffer — six months in.",
};

// ── How it's calculated ───────────────────────────────────────────────────────

export interface ScoreFactorInfo {
  key: ScoreFactorKey;
  label: string;
  weightPct: number;
  description: string;
  looksAt: string[];
}

const FACTOR_COPY: Record<ScoreAccountType, Record<ScoreFactorKey, { description: string; looksAt: string[] }>> = {
  personal: {
    identity: {
      description: "Is the account verifiably yours and well protected?",
      looksAt: ["Identity verification (KYC) result", "Email confirmed", "Transaction PIN set", "Phone number and country on your profile"],
    },
    history: {
      description: "How long you've been with S-PAY and how consistently you use it.",
      looksAt: ["Account age (full marks at 2 years)", "Months with activity in the last 12"],
    },
    payments: {
      description: "Do your payments go through cleanly, and do you use S-PAY regularly?",
      looksAt: ["Completed vs. failed transactions (last 90 days)", "How regularly you transact"],
    },
    income: {
      description: "Does money arrive steadily, from more than one source?",
      looksAt: ["Months with income in the last 6", "Number of different payers (a count — never who)", "Employer payroll received through S-PAY", "Income size, on a gentle log scale — consistency beats size"],
    },
    health: {
      description: "Do you keep a little buffer of what you earn?",
      looksAt: ["Share of the last 6 months' income still in your wallet", "Cashing out everything is normal and never scored below neutral"],
    },
  },
  business: {
    identity: {
      description: "Is the business verified and the account secured?",
      looksAt: ["Business verification (KYB) result", "Registered business name", "Verified payroll employer profile", "Email, phone and transaction PIN"],
    },
    history: {
      description: "How long the business has operated on S-PAY, and how consistently.",
      looksAt: ["Account age (full marks at 2 years)", "Months with activity in the last 12"],
    },
    payments: {
      description: "Do your workers get paid on time, every time?",
      looksAt: ["Share of worker payments that succeed (last 6 months, live payroll only)", "Batches that fail outright", "Months with a completed payroll run", "Falls back to everyday transaction success if you don't use Payroll"],
    },
    income: {
      description: "Is cash coming in steadily from a diverse customer base?",
      looksAt: ["Months with incoming payments in the last 6", "Number of different payers", "Volume, on a log scale"],
    },
    health: {
      description: "Can you cover your next payroll?",
      looksAt: ["Payroll float vs. your average batch (full marks at 1× coverage)", "Without Payroll: the share of income kept in the wallet"],
    },
  },
};

export function scoreFactorInfo(accountType: ScoreAccountType): ScoreFactorInfo[] {
  return (Object.keys(FACTOR_COPY[accountType]) as ScoreFactorKey[]).map((key) => ({
    key,
    label: SCORE_FACTOR_LABELS[accountType][key],
    weightPct: Math.round(SCORE_WEIGHTS[accountType][key] * 100),
    ...FACTOR_COPY[accountType][key],
  }));
}

// ── Bands & benefits ──────────────────────────────────────────────────────────

export type BenefitStatus = "live" | "planned";

export interface ScoreBenefit {
  title: string;
  description: string;
  status: BenefitStatus;
  audience: "all" | "personal" | "business";
}

export const SCORE_BENEFITS: readonly ScoreBenefit[] = [
  { title: "Know where you stand — free", description: "See your score, its five factors and your score history any time. No fees, no credit check, and checking never lowers it.", status: "live", audience: "all" },
  { title: "A personal plan to raise it", description: "Tailored actions ranked by how many points each one is worth, worked out by the same model that scores you.", status: "live", audience: "all" },
  { title: "Shareable proof of reliability", description: "Send a verified, expiring link to an employer, client, landlord or supplier. You choose whether it shows your exact score or just your band.", status: "live", audience: "all" },
  { title: "A credit history from day one", description: "Most remote workers have no local credit file. Every month on S-PAY adds to a record you own — built from real income, not collateral.", status: "live", audience: "personal" },
  { title: "A trust signal for your business", description: "Show workers, partners and suppliers that you run payroll reliably and keep your float funded.", status: "live", audience: "business" },
  { title: "Higher limits & faster reviews", description: "Members in higher bands are first in line for raised card and withdrawal limits.", status: "planned", audience: "all" },
  { title: "Lower fees for top bands", description: "Fee discounts for Great and Excellent members as the program grows.", status: "planned", audience: "all" },
  { title: "Pay-later & deposit-free services", description: `Members at ${SCORE_TRUSTED_THRESHOLD}+ become eligible for pay-later and no-deposit offers with S-PAY partners.`, status: "planned", audience: "all" },
  { title: "Credit, loans & insurance from licensed partners", description: `From around ${SCORE_PARTNER_SHARING_TARGET_YEAR}, and only if you switch partner sharing on, licensed banks, lenders and insurers may use your score history to offer you fairer credit, working-capital loans and cover.`, status: "planned", audience: "all" },
];

export const SCORE_BAND_PERKS: Record<ScoreBandKey, { live: string[]; planned: string[] }> = {
  building: {
    live: ["Free score, factor breakdown and monthly history", "Personal improvement plan with point estimates"],
    planned: [],
  },
  good: {
    live: ["Everything in Building", `"Trusted member" mark on your shareable score proof (${SCORE_TRUSTED_THRESHOLD}+)`],
    planned: ["Eligibility for pay-later & deposit-free partner offers"],
  },
  great: {
    live: ["Everything in Good"],
    planned: ["First in line for higher card & withdrawal limits", "Priority support routing"],
  },
  excellent: {
    live: ["Everything in Great"],
    planned: ["Fee discounts", `First access to partner credit offers from ~${SCORE_PARTNER_SHARING_TARGET_YEAR} (opt-in only)`],
  },
};

export function scoreBandsWithPerks() {
  return SCORE_BANDS.map((b) => ({ ...b, perks: SCORE_BAND_PERKS[b.key] }));
}

// ── Data: what, how, why ──────────────────────────────────────────────────────

export const SCORE_DATA_USED: readonly { title: string; description: string }[] = [
  { title: "Verification status", description: "Whether your identity (KYC) or business (KYB) check passed — never your documents, which stay with our licensed verification partner." },
  { title: "Account set-up", description: "Email confirmed, phone and country added, transaction PIN set, registered business name, account age." },
  { title: "Transaction records in S-PAY", description: "Counts, totals, timing and success/failure of payments you send and receive — summarised, never copied into your score." },
  { title: "Income patterns", description: "Which months money arrived and from how many different payers (a number, never their names), including employer payroll." },
  { title: "Payroll records (business)", description: "Live payroll batches, worker-payment success, and your payroll float. Sandbox/test activity is always excluded." },
];

export const SCORE_DATA_NOT_USED: readonly string[] = [
  "Your contacts, messages, photos or files",
  "GPS location or browsing history",
  "Social media accounts or friends",
  "Jobs you browse or apply to on the S-PAY jobs board",
  "Gender, ethnicity, religion, health, marital status or political views",
  "Data bought from data brokers or other apps",
  "The identity documents or selfie from verification",
];

export const SCORE_HOW_COLLECTED: readonly string[] = [
  "Automatically, from activity that already happens in your S-PAY account — there are no extra forms or permissions.",
  "Your score is recalculated when you open it (at most every few hours) and refreshed in the background at least monthly.",
  "Once a month we keep one snapshot: your score, the five factor values and the aggregate numbers behind them (counts and totals — not individual transactions).",
  "Every snapshot is stamped with the model version, so any past score can always be explained and checked.",
  "Snapshots stay in S-PAY's own secured database, under the same protections as your account. Turning the score off stops new snapshots immediately.",
];

export const SCORE_WHY_COLLECTED: readonly { title: string; description: string }[] = [
  { title: "To show you your financial health", description: "A clear number and a plan help you build better money habits — and prove them." },
  { title: "To reward reliable members", description: "Over time, higher bands unlock better S-PAY terms such as higher limits and lower fees (planned)." },
  { title: "To give the credit-invisible a track record", description: "Millions of remote workers are paid well but have no local credit history. A multi-year S-PAY record changes that." },
  { title: `To prepare fair credit access by ~${SCORE_PARTNER_SHARING_TARGET_YEAR}`, description: "Lenders need years of history to price credit fairly. We're building that history now so that — only with your consent — licensed financial institutions can use it later." },
];

export const SCORE_PARTNER_SHARING_NOTICE =
  `Partner sharing is OFF by default and nothing is shared with any financial institution today. S-PAY plans to open ` +
  `score-based offers with licensed banks, lenders and insurers from around ${SCORE_PARTNER_SHARING_TARGET_YEAR}. If you switch ` +
  `partner sharing on, you agree that — once that program launches — S-PAY may give licensed partners your S-PAY Score, band, ` +
  `factor values and monthly score history so they can make you offers. Partners will be named before anything is shared, ` +
  `we'll ask again if the terms change, and you can switch it off at any time. We never sell your data.`;

// ── How to keep it high ───────────────────────────────────────────────────────

export const SCORE_TIPS: Record<ScoreAccountType, readonly { title: string; description: string }[]> = {
  personal: [
    { title: "Verify your identity", description: "The biggest single boost — and it unlocks your US/EU bank accounts and cash-outs." },
    { title: "Lock your account down", description: "Confirm your email, add your phone number and set a transaction PIN." },
    { title: "Get paid through S-PAY every month", description: "Share your bank details or S-PAY ID with every client. Monthly income is the strongest signal." },
    { title: "Have more than one payer", description: "Income from two or three clients is steadier than one — and it shows." },
    { title: "Keep payments clean", description: "Check the recipient and your balance before you send. Failed transactions count against you for 90 days." },
    { title: "Leave a 10–20% buffer", description: "Keeping a slice of each payment in your wallet maxes out Balance health. Cashing out the rest is fine." },
    { title: "Be patient and stay active", description: "History builds for two years. Avoid long gaps and your score keeps climbing on its own." },
  ],
  business: [
    { title: "Complete business verification (KYB)", description: "The biggest single boost — it also unlocks company-name accounts and live payroll." },
    { title: "Run payroll through S-PAY on schedule", description: "Paying your team every month is the strongest business signal." },
    { title: "Keep worker details accurate", description: "Validate emails, phones and S-PAY IDs before you submit — failed worker payments lower reliability." },
    { title: "Fund your float before payday", description: "Keep enough balance to cover at least one average payroll batch." },
    { title: "Collect customer payments into S-PAY", description: "Steady monthly cash flow from several customers lifts your Cash flow factor." },
    { title: "Secure the account", description: "Confirm the email, add a phone number, set a transaction PIN and your registered business name." },
  ],
};

export const SCORE_MYTHS: readonly { myth: string; fact: string }[] = [
  { myth: "Checking my score lowers it.", fact: "Never. Look as often as you like." },
  { myth: "Cashing out to M-Pesa or my bank hurts my score.", fact: "No. Withdrawing is what S-PAY is for. Balance health never drops below neutral for cashing out." },
  { myth: "Only rich people get high scores.", fact: "Size counts least, on a log scale. Consistency, verification and clean payments count most." },
  { myth: "S-PAY can freeze my money because of my score.", fact: "No. Your score is never used to freeze, hold or block your own funds." },
];

// ── Your controls ─────────────────────────────────────────────────────────────

export const SCORE_CONTROLS: readonly { title: string; description: string }[] = [
  { title: "Turn the score off", description: "Stops all new score calculation and collection straight away. Turn it back on whenever you like." },
  { title: "Delete your score history", description: "Erase every stored monthly snapshot and start fresh." },
  { title: "Download your score data", description: "Get your score, history and consent record as a file (data portability)." },
  { title: "Choose about partner sharing", description: "Off by default. Switch it on or off at any time — every change is recorded with a timestamp." },
  { title: "Revoke shared links", description: "Cancel every score-proof link you've sent, instantly." },
  { title: "Ask, correct or object", description: "Think something is wrong? Email privacy@spayewallet.com — we reply within 30 days, and a person reviews any dispute." },
];

// ── Roadmap ───────────────────────────────────────────────────────────────────

export const SCORE_TIMELINE: readonly { when: string; title: string; description: string; status: BenefitStatus }[] = [
  { when: "2026", title: "S-PAY Score launches", description: "Scores for every personal and business account, improvement plans, score history, shareable proof and full privacy controls.", status: "live" },
  { when: "2027–2028", title: "Rewards inside S-PAY", description: "Band-based benefits roll out inside S-PAY: higher limits, faster reviews and fee discounts.", status: "planned" },
  { when: "2029–2030", title: "Independent review", description: "External fairness and accuracy review of the model before any partner use, plus partner and regulator due diligence.", status: "planned" },
  { when: `~${SCORE_PARTNER_SHARING_TARGET_YEAR}`, title: "Licensed partner offers (opt-in)", description: "Members who switched partner sharing on can receive credit, loan and insurance offers from licensed financial institutions.", status: "planned" },
];

// ── FAQ ───────────────────────────────────────────────────────────────────────

export const SCORE_FAQS: readonly { q: string; a: string }[] = [
  { q: "What is the S-PAY Score?", a: `A free ${SCORE_MIN}–${SCORE_MAX} score that reflects how reliably you get paid, pay and manage money on S-PAY. Every personal and business account has one, with a breakdown of five factors and a plan to raise it.` },
  { q: "Is it the same as a credit-bureau score?", a: "No. It's S-PAY's own score, built only from your S-PAY activity. It isn't reported to any credit bureau and doesn't use a bureau file." },
  { q: "What score is good?", a: `${SCORE_BANDS.map((b) => `${b.min}–${b.max} is ${b.label}`).join(", ")}. ${SCORE_TRUSTED_THRESHOLD}+ marks a trusted member.` },
  { q: "Why is my new score low?", a: "New accounts start in Building because there's little history yet. Verifying your identity, securing your account and getting paid through S-PAY for a couple of months moves most members into Good." },
  { q: "How often does it update?", a: "When you open it (at most every few hours) and at least once a month in the background. One snapshot per month is kept as your history." },
  { q: "Do business accounts get a score?", a: "Yes — the Business Score uses the same 300–850 scale but weighs payroll reliability, cash flow and payroll float more heavily." },
  { q: "Will S-PAY sell my data or share it with lenders?", a: `We never sell your data. Nothing is shared with financial institutions today. From around ${SCORE_PARTNER_SHARING_TARGET_YEAR}, licensed partners may see your score only if you've switched partner sharing on — and you can switch it off any time.` },
  { q: "Does withdrawing or cashing out hurt my score?", a: "No. Cashing out is normal and is never scored below neutral. Keeping a small 10–20% buffer simply earns a little extra." },
  { q: "Can I turn it off or delete it?", a: "Yes. In My Score → Your controls you can turn the score off, delete your history, download your data and revoke shared links." },
  { q: "Can my score be used against me?", a: "Your score is never used to freeze, hold or block your own money, and it doesn't use sensitive traits like gender, ethnicity, religion or location." },
];

// ── Public page meta + structured data (shared by the SPA and the SSR page) ───

export const SCORE_PAGE_PATH = "/score";

export const SCORE_PAGE_META = {
  title: "S-PAY Score — Free 300–850 Score for Remote Workers & Businesses",
  description:
    "S-PAY Score is a free 300–850 score built from how you get paid and pay on S-PAY — for individuals and businesses. " +
    "See how it's calculated, what data it uses, its benefits and how to keep it high.",
};

export function scorePageJsonLd(siteUrl: string): object[] {
  const site = siteUrl.replace(/\/+$/, "");
  const url = `${site}${SCORE_PAGE_PATH}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: SCORE_PAGE_META.title,
      url,
      description: SCORE_PAGE_META.description,
      isPartOf: { "@type": "WebSite", name: "S-PAY", url: site },
      about: {
        "@type": "FinancialProduct",
        name: SCORE_PRODUCT_NAME,
        description: SCORE_INTRO,
        provider: { "@type": "Organization", name: "S-PAY", url: site },
        feesAndCommissionsSpecification: "Free — checking your score never costs anything or lowers it.",
        areaServed: "Worldwide",
        audience: [
          { "@type": "Audience", audienceType: "Remote workers and freelancers" },
          { "@type": "BusinessAudience", audienceType: "Businesses that pay remote teams" },
        ],
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "S-PAY", item: `${site}/` },
        { "@type": "ListItem", position: 2, name: SCORE_PRODUCT_NAME, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: SCORE_FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];
}
