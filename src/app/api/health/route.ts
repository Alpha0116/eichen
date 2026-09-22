import { NextResponse } from "next/server";
import { smtpSettingsFromEnv } from "@/adapters/smtp/notifications";
import { CONTACT } from "@/server/config";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * What is running, and whether it can work.
 *
 * Answers the two questions a failed deploy leaves open — which commit is
 * live, and did the database come with it — without a session or a browser.
 * The rule set check is the one that matters for a fresh database: an empty
 * one takes uploads and logins fine and only fails at the review step. The
 * mail block answers "the code never came": whether a real transport is
 * configured at all, which mailbox it aims at, and how the last code fared.
 */

/** `ops@example.com` → `o**@example.com`: enough to recognise, not to harvest. */
function maskMailbox(address: string): string {
  const at = address.indexOf("@");
  if (at < 1) return "***";
  return `${address[0]}**${address.slice(at)}`;
}
export async function GET() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;
  const storage = process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "database";

  let database: "ok" | "unreachable" = "ok";
  let ruleSet: string | null = null;
  try {
    const row = await db.ruleSetRecord.findFirst({
      where: { status: "PUBLISHED" },
      orderBy: { version: "desc" },
      select: { key: true, version: true },
    });
    ruleSet = row ? `${row.key} v${row.version}` : null;
  } catch {
    database = "unreachable";
  }

  let lastAdminCode: { status: string; sentAt: Date } | null = null;
  if (database === "ok") {
    lastAdminCode = await db.notification.findFirst({
      where: { templateKey: "admin_setup_code" },
      orderBy: { sentAt: "desc" },
      select: { status: true, sentAt: true },
    });
  }
  const mail = {
    transport: smtpSettingsFromEnv() ? "smtp" : "outbox",
    opsMailbox: maskMailbox(CONTACT.opsEmail),
    lastAdminCode,
  };

  const ok = database === "ok" && ruleSet !== null;
  return NextResponse.json({ ok, commit, storage, database, ruleSet, mail }, { status: ok ? 200 : 503 });
}
