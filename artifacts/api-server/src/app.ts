import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import ssrRouter from "./routes/ssr";
import { maintenanceGate } from "./middlewares/maintenance";
import { logger } from "./lib/logger";

const app: Express = express();

// Behind Render's proxy: needed so rate limiting sees real client IPs
app.set("trust proxy", 1);

// Hardened HTTP headers. CSP is off because this server also renders the
// crawler job pages with inline styles; everything else (nosniff, frame
// denial, HSTS, referrer policy…) applies.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

// Brute-force shield on credential endpoints (per-IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Too many attempts — try again in a few minutes." },
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// CORS — two tiers:
//  • PUBLIC read endpoints (jobs board, sitemap, marketing content, health,
//    status) carry NO credentials and expose NO user data, so they're readable
//    from any origin. This keeps the landing page + /jobs working for every
//    visitor even if CORS_ORIGIN is mis-set or they browse via www/preview.
//  • Everything else (auth, wallet, admin…) is locked to the CORS_ORIGIN
//    allowlist with credentials. Unset = allow all (dev-friendly).
// S-PAY's own production web origins. These are ALWAYS allowed when an
// allowlist is in force, so a CORS_ORIGIN typo (e.g. setting the apex but
// forgetting the www. host) can never lock real users out of login/wallet —
// the symptom is a browser "Failed to fetch" on the credentialed endpoints
// even though the public jobs board still loads.
const BUILTIN_ORIGINS = ["https://spayewallet.com", "https://www.spayewallet.com"];

const envOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
  : null;

// Unset CORS_ORIGIN => null => allow any origin (dev-friendly). When set, merge
// in the built-in production origins so they're always permitted.
const allowedOrigins = envOrigins ? Array.from(new Set([...envOrigins, ...BUILTIN_ORIGINS])) : null;

const PUBLIC_READ = [/^\/api\/jobs/, /^\/api\/sitemap\.xml/, /^\/api\/site-content/, /^\/api\/status/, /^\/api\/healthz/];

app.use(cors((req, done) => {
  // Match the GET *and* its preflight: once a user logs in the client adds an
  // Authorization header, which makes /api/jobs a non-simple request — the
  // browser sends an OPTIONS preflight first. Both must use the open policy or
  // the authenticated jobs/board fetch gets blocked even though the data is public.
  const isPublicRead = (req.method === "GET" || req.method === "OPTIONS") && PUBLIC_READ.some((re) => re.test(req.path));
  if (isPublicRead || !allowedOrigins) {
    // Reflect any origin; no credentials needed for public data
    done(null, { origin: true, credentials: false });
    return;
  }
  done(null, {
    credentials: true,
    origin: (origin, cb) => {
      // No Origin header = same-origin or server-to-server (curl, webhooks)
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      logger.warn(
        { blockedOrigin: origin, allowedOrigins },
        "CORS blocked a browser origin — users there see “Failed to fetch”. Add the origin to CORS_ORIGIN (exact scheme+host, no trailing slash, include the www. variant if used)",
      );
      cb(null, false);
    },
  });
}));
// Keep the exact raw bytes so webhook HMAC signatures (Noah/Stripe) verify
// against what was actually sent, not a re-serialized body.
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true }));

app.use(["/api/auth/login", "/api/auth/register", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/auth/resend-verification", "/api/auth/pin"], authLimiter);
app.use("/api", maintenanceGate, router);
// Server-rendered job pages for crawlers (kept up during maintenance so
// indexing never stalls) — Vercel routes bot traffic here, humans get the SPA.
app.use("/ssr", ssrRouter);

export default app;
