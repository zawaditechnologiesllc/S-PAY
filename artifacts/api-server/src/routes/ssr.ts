import { Router, type IRouter } from "express";
import { fetchJobs, getJobById, CATEGORY_LABELS, type NormalizedJob } from "../lib/jobs";
import { articleJsonLd } from "../lib/seo";
import { db, blogPostsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";

// Minimal, safe Markdown → HTML for blog bodies. Escapes all HTML first, then
// only emits a known tag set; links are restricted to http(s) or same-origin
// relative paths (protocol-relative "//host" links are rejected) — so the
// AI-generated body can never inject script/styles/handlers.
function mdToHtml(md: string): string {
  const escAll = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    escAll(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/(?!\/)[^\s)]*)\)/g, '<a href="$2" rel="noopener">$1</a>');
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  let para: string[] = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushPara(); closeList(); continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flushPara(); closeList(); const lvl = Math.min(h[1].length, 6); out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flushPara(); closeList(); out.push("<hr/>"); continue; }
    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ul) { flushPara(); if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(ul[1])}</li>`); continue; }
    if (ol) { flushPara(); if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(ol[1])}</li>`); continue; }
    const bq = line.match(/^>\s?(.*)$/);
    if (bq) { flushPara(); closeList(); out.push(`<blockquote>${inline(bq[1])}</blockquote>`); continue; }
    closeList(); para.push(line);
  }
  flushPara(); closeList();
  return out.join("\n");
}

// Server-rendered job pages for search engines & social previews.
// Vercel routes bot user-agents on spayewallet.com/jobs* here (see
// vercel.json); humans keep the SPA. Content is identical to the SPA
// pages — same data, same canonical URLs — so this is compliant dynamic
// rendering, not cloaking.

const router: IRouter = Router();

const SITE = () => (process.env.SITE_URL ?? "https://spayewallet.com").replace(/\/+$/, "");

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript\s*:/gi, "");
}

// Google for Jobs requires applicantLocationRequirements on remote (TELECOMMUTE)
// postings. We always emit it: a named country when the role is geo-restricted,
// otherwise "Worldwide" for roles open anywhere — which clears the critical
// "Missing field applicantLocationRequirements" Search Console error.
const GENERIC_REMOTE = /worldwide|remote|anywhere|global|distributed/i;
function applicantLocationRequirements(location: string | undefined) {
  const loc = (location ?? "").trim();
  const name = !loc || GENERIC_REMOTE.test(loc) ? "Worldwide" : loc;
  return { "@type": "Country", name };
}

// Best-effort parse of a free-text salary ("$50k–$70k", "$30/hour", "€45,000 per
// year") into a schema.org MonetaryAmount for the optional baseSalary field.
// Returns null for non-numeric salaries ("Competitive", "DOE") so we simply omit
// the field — baseSalary is non-critical, so absence is valid.
function parseBaseSalary(salary: string | undefined): object | null {
  if (!salary || !/\d/.test(salary)) return null;
  const s = salary;
  const currency = /€|eur/i.test(s) ? "EUR" : /£|gbp/i.test(s) ? "GBP" : "USD";
  const unitText = /hour|\/\s*hr|\bhr\b|per hour|hourly/i.test(s) ? "HOUR"
    : /\/\s*wk|per week|weekly|\bweek\b/i.test(s) ? "WEEK"
    : /\/\s*mo|per month|monthly|\bmonth\b/i.test(s) ? "MONTH"
    : "YEAR";

  const nums: number[] = [];
  const re = /(\d[\d,.]*)\s*([kK])?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    let n = parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    if (m[2]) n *= 1000; // "50k" → 50000
    nums.push(n);
  }
  if (nums.length === 0) return null;

  const value = nums.length >= 2
    ? { "@type": "QuantitativeValue", minValue: Math.min(...nums), maxValue: Math.max(...nums), unitText }
    : { "@type": "QuantitativeValue", value: nums[0], unitText };
  return { "@type": "MonetaryAmount", currency, value };
}

function pageShell(opts: {
  title: string;
  description: string;
  canonical: string;
  jsonLd?: object;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="${esc(opts.canonical)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="S-PAY" />
<meta property="og:title" content="${esc(opts.title)}" />
<meta property="og:description" content="${esc(opts.description)}" />
<meta property="og:url" content="${esc(opts.canonical)}" />
<meta property="og:image" content="${SITE()}/opengraph.jpg" />
<meta name="twitter:card" content="summary_large_image" />
${opts.jsonLd ? `<script type="application/ld+json">${JSON.stringify(opts.jsonLd)}</script>` : ""}
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, Inter, sans-serif; color: #1A2B4A; background: #f8fafc; }
  a { color: #2E8FD6; text-decoration: none; }
  .nav { background: #1A2B4A; padding: 14px 20px; }
  .nav a { color: #fff; font-weight: 800; font-size: 18px; letter-spacing: 0.3px; }
  .wrap { max-width: 860px; margin: 0 auto; padding: 28px 20px 60px; }
  .card { background: #fff; border: 1px solid #e5e9f0; border-radius: 14px; padding: 18px 20px; margin-bottom: 12px; }
  .meta { color: #5b6b85; font-size: 14px; margin: 4px 0 0; }
  .badge { display: inline-block; background: #E8F7FC; color: #1A2B4A; font-size: 12px; font-weight: 700; border-radius: 999px; padding: 3px 10px; margin-right: 6px; }
  .cta { display: inline-block; background: #4DC9EE; color: #fff !important; font-weight: 800; padding: 13px 26px; border-radius: 12px; margin-top: 18px; }
  .spay-callout { background: linear-gradient(135deg, #1A2B4A, #0d1f38); border-radius: 14px; padding: 20px 22px; margin: 18px 0; color: #fff; }
  .spay-callout p { margin: 0 0 14px; font-size: 16px; font-weight: 700; color: #fff; }
  .spay-callout .cta { margin-top: 0; }
  .desc { line-height: 1.65; font-size: 15.5px; }
  .desc img { max-width: 100%; }
  h1 { font-size: 26px; line-height: 1.25; margin: 0 0 6px; }
  h2 { font-size: 18px; margin: 26px 0 10px; }
  footer { color: #5b6b85; font-size: 13px; text-align: center; padding: 26px 16px; }
  .celo { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #FCFF52; margin-right: 6px; vertical-align: baseline; }
</style>
</head>
<body>
<nav class="nav"><a href="${SITE()}/">S-PAY</a></nav>
<div class="wrap">
${opts.body}
</div>
<footer><span class="celo"></span>Built on Celo · © ${new Date().getFullYear()} S-PAY · Zawadi Technologies LLC · <a href="${SITE()}/jobs">All remote jobs</a></footer>
</body>
</html>`;
}

// ── Jobs index: crawlable list with links into every detail page ─────────────

router.get("/jobs", async (req, res) => {
  try {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const { jobs, total } = await fetchJobs(undefined, category, 1000);

    const catLinks = CATEGORY_LABELS.map(
      (c) => `<a class="badge" href="${SITE()}/jobs?category=${encodeURIComponent(c)}">${c}</a>`,
    ).join(" ");

    const items = jobs.map((j) => `
      <div class="card">
        <a href="${SITE()}/jobs/${encodeURIComponent(j.id)}"><strong>${esc(j.title)}</strong></a>
        <p class="meta">${esc(j.company)} · ${esc(j.category)} · ${esc(j.location)}${j.salary && j.salary !== "Competitive" ? ` · ${esc(j.salary)}` : ""}</p>
      </div>`).join("\n");

    const countLabel = total > 0 ? total.toLocaleString() : "Thousands of";
    const title = category
      ? `${category} Remote Jobs${total > 0 ? ` (${total.toLocaleString()} open)` : ""} | S-PAY`
      : `${countLabel} Remote Jobs Hiring Now — Updated Hourly | S-PAY`;
    const description = `Browse ${countLabel.toLowerCase() === "thousands of" ? "thousands of" : countLabel} fully remote ${category ? category.toLowerCase() + " " : ""}jobs from 60+ sources, updated hourly. Apply free with S-PAY — get paid globally, cash out to M-Pesa, MoMo, PIX and more.`;

    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=600");
    res.send(pageShell({
      title,
      description,
      canonical: `${SITE()}/jobs${category ? `?category=${encodeURIComponent(category)}` : ""}`,
      body: `
        <h1>${category ? `${esc(category)} remote jobs` : "Remote jobs hiring now"}</h1>
        <p class="meta">${total.toLocaleString()} open roles · refreshed hourly · free to apply</p>
        <p>${catLinks}</p>
        ${items}
        <a class="cta" href="${SITE()}/register?from=jobs">Create a free S-PAY account to apply</a>`,
    }));
  } catch (err) {
    req.log.error({ err }, "SSR jobs index error");
    res.status(500).send("");
  }
});

// ── Job detail: full content + Google for Jobs structured data ───────────────

router.get("/jobs/:jobId", async (req, res) => {
  try {
    const job = await getJobById(req.params.jobId as string);
    if (!job) {
      res.status(404).set("Content-Type", "text/html; charset=utf-8").send(pageShell({
        title: "Job no longer available | S-PAY Remote Jobs",
        description: "This listing has closed — browse thousands of live remote jobs on S-PAY.",
        canonical: `${SITE()}/jobs`,
        body: `<h1>This job is no longer available</h1>
               <p class="meta">Listings rotate daily. Thousands more are live right now.</p>
               <a class="cta" href="${SITE()}/jobs">Browse all remote jobs</a>`,
      }));
      return;
    }

    const canonical = `${SITE()}/jobs/${encodeURIComponent(job.id)}`;
    const descriptionHtml = job.description
      ? sanitizeHtml(job.description)
      : `<p>${esc(job.title)} at ${esc(job.company)} — a fully remote position listed on the S-PAY jobs board.</p>`;
    const plainDesc = descriptionHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const posted = new Date(job.postedAt);
    const validThrough = new Date(posted.getTime() + 60 * 24 * 60 * 60 * 1000);
    const baseSalary = parseBaseSalary(job.salary);

    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: job.title,
      description: descriptionHtml,
      datePosted: job.postedAt,
      validThrough: validThrough.toISOString(),
      employmentType: "FULL_TIME",
      hiringOrganization: { "@type": "Organization", name: job.company },
      jobLocationType: "TELECOMMUTE",
      // Required by Google for remote postings — always present now.
      applicantLocationRequirements: applicantLocationRequirements(job.location),
      directApply: false,
      ...(baseSalary ? { baseSalary } : {}),
    };

    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=600");
    res.send(pageShell({
      title: `${job.title} at ${job.company} — Remote Job | S-PAY`,
      description: plainDesc.slice(0, 158) || `${job.title} at ${job.company} — remote role on the S-PAY jobs board.`,
      canonical,
      jsonLd,
      body: `
        <p><a href="${SITE()}/jobs">← All remote jobs</a></p>
        <h1>${esc(job.title)}</h1>
        <p class="meta">${esc(job.company)} · ${esc(job.location)}${job.salary && job.salary !== "Competitive" ? ` · ${esc(job.salary)}` : ""}</p>
        <p>
          <span class="badge">${esc(job.category)}</span>
          <span class="badge">Remote</span>
          ${job.isNew ? '<span class="badge">New</span>' : ""}
        </p>
        <div class="spay-callout">
          <p>Want to get paid and payout locally? Sign up for S-PAY.</p>
          <a class="cta" href="${SITE()}/register?from=jobs&jobId=${encodeURIComponent(job.id)}">Sign up for S-PAY — it's free</a>
        </div>
        <h2>About this role</h2>
        <div class="desc">${descriptionHtml}</div>
        <div class="spay-callout">
          <p>Want to get paid and payout locally? Sign up for S-PAY.</p>
          <a class="cta" href="${SITE()}/register?from=jobs&jobId=${encodeURIComponent(job.id)}">Sign up for S-PAY — it's free</a>
        </div>
        <h2>Get hired — and get paid — with S-PAY</h2>
        <ul>
          <li><strong>Apply free:</strong> the S-PAY jobs board lists thousands of remote ${esc(job.category.toLowerCase())} roles, refreshed hourly.</li>
          <li><strong>Get paid like a local:</strong> verified members receive a US bank account and EU IBAN to share with employers worldwide.</li>
          <li><strong>Cash out where you live:</strong> M-Pesa, MTN Mobile Money, GCash, PIX, SEPA and 50+ methods, usually within minutes.</li>
        </ul>
        <p class="meta"><a href="${SITE()}/how-it-works">How S-PAY works</a> · <a href="${SITE()}/jobs?category=${encodeURIComponent(job.category)}">More remote ${esc(job.category.toLowerCase())} jobs</a> · <a href="${SITE()}/jobs">All remote jobs</a></p>`,
    }));
  } catch (err) {
    req.log.error({ err }, "SSR job detail error");
    res.status(500).send("");
  }
});

// ── Blog: crawlable index + full server-rendered articles (Article JSON-LD) ──

router.get("/blog", async (req, res) => {
  try {
    const rows = await db.select().from(blogPostsTable)
      .where(eq(blogPostsTable.status, "published"))
      .orderBy(desc(blogPostsTable.publishedAt)).limit(200);
    const items = rows.map((p) =>
      `<div class="card"><h2><a href="${SITE()}/blog/${esc(p.slug)}">${esc(p.title)}</a></h2>` +
      `<p class="meta">${esc(p.metaDescription ?? p.excerpt ?? "")}</p></div>`,
    ).join("\n");
    res.set("Cache-Control", "public, max-age=600");
    res.send(pageShell({
      title: "S-PAY Blog — money tips for global remote workers",
      description: "Guides on getting paid globally and cashing out locally — for remote workers, freelancers and the businesses that pay them.",
      canonical: `${SITE()}/blog`,
      body: `<h1>S-PAY Blog</h1>${items || "<p>New articles are on the way.</p>"}`,
    }));
  } catch (err) {
    req.log?.error?.({ err }, "Blog SSR index error");
    res.status(500).send("");
  }
});

router.get("/blog/:slug", async (req, res) => {
  try {
    const [p] = await db.select().from(blogPostsTable)
      .where(and(eq(blogPostsTable.slug, String(req.params.slug)), eq(blogPostsTable.status, "published")))
      .limit(1);
    if (!p) {
      res.status(404).send(pageShell({
        title: "Article not found · S-PAY", description: "This article isn't available.",
        canonical: `${SITE()}/blog`, body: `<h1>Not found</h1><p><a href="${SITE()}/blog">Back to the blog</a></p>`,
      }));
      return;
    }
    const body =
      `<h1>${esc(p.title)}</h1>` +
      `<p class="meta">${p.publishedAt ? new Date(p.publishedAt).toDateString() : ""}</p>` +
      `<div class="desc">${mdToHtml(p.bodyMarkdown)}</div>` +
      `<div class="spay-callout"><p>Get paid globally. Cash out locally — M-Pesa, PIX, SEPA, bank.</p>` +
      `<a class="cta" href="${SITE()}/register">Open a free S-PAY account</a></div>`;
    res.set("Cache-Control", "public, max-age=600");
    res.send(pageShell({
      title: `${p.title} · S-PAY`,
      description: p.metaDescription ?? p.excerpt ?? p.title,
      canonical: `${SITE()}/blog/${esc(p.slug)}`,
      jsonLd: articleJsonLd(p, SITE()),
      body,
    }));
  } catch (err) {
    req.log?.error?.({ err }, "Blog SSR article error");
    res.status(500).send("");
  }
});

export default router;
