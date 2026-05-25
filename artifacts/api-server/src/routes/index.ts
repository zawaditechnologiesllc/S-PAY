import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import walletRouter from "./wallet";
import bankingRouter from "./banking";
import cardRouter from "./card";
import jobsRouter from "./jobs";
import webhooksRouter from "./webhooks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(walletRouter);
router.use(bankingRouter);
router.use(cardRouter);
router.use(jobsRouter);
router.use(webhooksRouter);

export default router;
