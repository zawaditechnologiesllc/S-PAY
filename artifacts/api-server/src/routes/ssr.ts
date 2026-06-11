import { Router, type IRouter } from "express";
import { fetchJobs, getJobById, CATEGORY_LABELS, type NormalizedJob } from "../lib/jobs";

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
    const restricted = job.location && !/worldwide|remote|anywhere|global/i.test(job.location);

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
      directApply: false,
      ...(restricted
        ? { applicantLocationRequirements: { "@type": "Country", name: job.location } }
        : {}),
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
        <h2>About this role</h2>
        <div class="desc">${descriptionHtml}</div>
        <a class="cta" href="${SITE()}/register?from=jobs&jobId=${encodeURIComponent(job.id)}">Sign up free to apply</a>
        <p class="meta">S-PAY members apply directly and get paid globally — virtual USD/EUR accounts, USDC/USDT wallet on Celo, instant cash-out to M-Pesa, MoMo, PIX and 50+ methods.</p>`,
    }));
  } catch (err) {
    req.log.error({ err }, "SSR job detail error");
    res.status(500).send("");
  }
});

export default router;
