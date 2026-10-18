import { getAuth } from "@clerk/express";
import type { RequestHandler, Response } from "express";
import { ensureFinanceUser } from "./finance-data";

export const requireAuth: RequestHandler = (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.locals.financeUserId = userId;
  next();
};

export const initializeFinanceUser: RequestHandler = async (_req, res, next) => {
  try {
    await ensureFinanceUser(getFinanceUserId(res));
    next();
  } catch (error) {
    next(error);
  }
};

export function getFinanceUserId(res: Response): string {
  const userId = res.locals.financeUserId;
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("Authenticated finance user is missing");
  }
  return userId;
}
