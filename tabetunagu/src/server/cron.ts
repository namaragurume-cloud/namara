import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "./env";

/** Vercel Cron は Authorization: Bearer <CRON_SECRET> を付けて呼び出す */
export function isAuthorizedCron(req: Request) {
  const secret = env.cronSecret;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
