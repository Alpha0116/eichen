import { NextResponse } from "next/server";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * What is running, and whether it can work.
 *
 * Answers the two questions a failed deploy leaves open — which commit is
 * live, and did the database come with it — without a session or a browser.
 * The rule set check is the one that matters for a fresh database: an empty
 * one takes uploads and logins fine and only fails at the review step.
 */
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

  const ok = database === "ok" && ruleSet !== null;
  return NextResponse.json({ ok, commit, storage, database, ruleSet }, { status: ok ? 200 : 503 });
}
