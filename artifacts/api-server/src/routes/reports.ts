import { Router } from "express";
import { getFinanceDashboard, getFinanceReport } from "../lib/finance-analytics";
import { getFinanceUserId } from "../lib/auth";

const router = Router();

router.get("/dashboard", async (_req, res) => {
  res.json(await getFinanceDashboard(getFinanceUserId(res)));
});

router.get("/reports/monthly", async (req, res) => {
  const rawMonth = typeof req.query.month === "string" ? req.query.month : "";
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(rawMonth);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) {
    res.status(400).json({ error: "Month must use YYYY-MM or YYYY-MM-DD" });
    return;
  }
  res.json(
    await getFinanceReport(getFinanceUserId(res), {
      kind: "month",
      value: `${match[1]}-${match[2]}`,
    }),
  );
});

router.get("/reports/yearly", async (req, res) => {
  const year = Number(req.query.year);
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    res.status(400).json({ error: "Year must be a four-digit year from 2000 onward" });
    return;
  }
  res.json(
    await getFinanceReport(getFinanceUserId(res), { kind: "year", value: year }),
  );
});

export default router;
