import { Router } from "express";
import { initializeFinanceUser, requireAuth } from "../lib/auth";
import accountsRouter from "./accounts";
import categoriesRouter from "./categories";
import coachRouter from "./coach";
import planningRouter from "./planning";
import reportsRouter from "./reports";
import settingsRouter from "./settings";
import transactionsRouter from "./transactions";
import transfersRouter from "./transfers";

const router = Router();

router.use(requireAuth, initializeFinanceUser);
router.use(accountsRouter);
router.use(categoriesRouter);
router.use(transactionsRouter);
router.use(transfersRouter);
router.use(planningRouter);
router.use(reportsRouter);
router.use(settingsRouter);
router.use(coachRouter);

export default router;
