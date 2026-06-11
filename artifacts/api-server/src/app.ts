import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { maintenanceGate } from "./middlewares/maintenance";
import { logger } from "./lib/logger";

const app: Express = express();

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
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : true;
app.use(cors({ origin: corsOrigin, credentials: true }));
// Keep the exact raw bytes so webhook HMAC signatures (Noah/Stripe) verify
// against what was actually sent, not a re-serialized body.
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true }));

app.use("/api", maintenanceGate, router);

export default app;
