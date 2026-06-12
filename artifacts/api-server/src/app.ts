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
// CORS: unset = allow all (dev-friendly); set = exact-match allowlist.
// A mismatched origin surfaces in the browser as a bare "Failed to fetch" on
// sign-up/sign-in, so log every rejection — the fix (add the origin to
// CORS_ORIGIN on Render) is then visible straight from the service logs.
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
  : null;
app.use(cors({
  origin: allowedOrigins
    ? (origin, cb) => {
        // No Origin header = same-origin or server-to-server (curl, webhooks) — not a browser CORS case
        if (!origin || allowedOrigins.includes(origin)) {
          cb(null, true);
          return;
        }
        logger.warn(
          { blockedOrigin: origin, allowedOrigins },
          "CORS blocked a browser origin — users there see “Failed to fetch”. If this is your web app, add the origin to CORS_ORIGIN (exact scheme+host, no trailing slash, include the www. variant if used)",
        );
        cb(null, false);
      }
    : true,
  credentials: true,
}));
// Keep the exact raw bytes so webhook HMAC signatures (Noah/Stripe) verify
// against what was actually sent, not a re-serialized body.
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true }));

app.use(["/api/auth/login", "/api/auth/register", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/auth/resend-verification"], authLimiter);
app.use("/api", maintenanceGate, router);
// Server-rendered job pages for crawlers (kept up during maintenance so
// indexing never stalls) — Vercel routes bot traffic here, humans get the SPA.
app.use("/ssr", ssrRouter);

export default app;
