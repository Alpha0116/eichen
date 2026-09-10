import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { db } from "../src/server/db";

/**
 * Captures the real pages with the locally installed Chrome, headlessly.
 *
 * Authenticated pages need a session cookie, and Chrome's simple --screenshot
 * mode has no way to set one. Rather than fabricating a login inside the
 * browser, each persona gets a tiny reverse proxy on its own port that adds the
 * Cookie header and forwards the path unchanged — so relative links and asset
 * URLs keep working without any rewriting.
 *
 * The proxies bind to loopback and live only for the duration of this script.
 */

const APP = "http://localhost:3000";
const CHROME = "/usr/bin/google-chrome";
const OUT = "/tmp/eichen-shots";

interface Persona {
  name: string;
  port: number;
  cookie: string | null;
}

async function mintSession(email: string, pending = false): Promise<string> {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: {
      userId: user.id,
      mfaPending: pending,
      tokenHash: createHash("sha256").update(token, "utf8").digest("hex"),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  return token;
}

function startProxy(persona: Persona): Promise<() => void> {
  // Hop-by-hop headers belong to one connection and must not be forwarded.
  // undici rejects them outright, which turns every proxied request into a 500.
  const HOP_BY_HOP = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "host",
    "cookie",
    "content-length",
  ]);

  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === "string" && !HOP_BY_HOP.has(key)) headers[key] = value;
    }
    if (persona.cookie) headers.cookie = `eichen_session=${persona.cookie}`;

    try {
      const upstream = await fetch(`${APP}${request.url ?? "/"}`, {
        method: request.method,
        headers,
        redirect: "manual",
      });
      // fetch has already decompressed the body, so the upstream
      // content-encoding and content-length no longer describe what is being
      // sent on — forwarding them truncates the page to a blank screen.
      const dropped = new Set(["content-encoding", "content-length", "transfer-encoding"]);
      response.writeHead(
        upstream.status,
        Object.fromEntries([...upstream.headers].filter(([key]) => !dropped.has(key))),
      );
      response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
      response.writeHead(502);
      response.end(String(error));
    }
  });

  return new Promise((resolve) => {
    server.listen(persona.port, "127.0.0.1", () => resolve(() => server.close()));
  });
}

function shoot(url: string, file: string, size: string, dark: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      `--window-size=${size}`,
      "--virtual-time-budget=6000",
      `--screenshot=${file}`,
      // preferredColorScheme drives the prefers-color-scheme media query, which
      // is what the stylesheet keys off. Determined empirically against this
      // Chrome build: 0 renders dark, 1 renders light. Headless defaults to dark.
      `--blink-settings=preferredColorScheme=${dark ? 0 : 1}`,
      url,
    ];
    const child = spawn(CHROME, args, { stdio: "ignore" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`chrome exit ${code}`))));
    child.on("error", reject);
  });
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const [customer, agentPending, agentFull] = await Promise.all([
    mintSession("kundin@eichen-kredit.com"),
    mintSession("risiko@eichen-kredit.com", true),
    mintSession("agent@eichen-kredit.com"),
  ]);

  // The full agent session needs a second factor on the account, otherwise the
  // staff guard sends it to enrolment — which is the correct behaviour.
  const agent = await db.user.findUniqueOrThrow({ where: { email: "agent@eichen-kredit.com" } });
  if (!agent.mfaEnabled) {
    const { generateSecret } = await import("../src/server/auth/totp");
    await db.user.update({
      where: { id: agent.id },
      data: { mfaSecret: generateSecret(), mfaEnabled: true, mfaEnrolledAt: new Date() },
    });
  }

  const personas: Persona[] = [
    { name: "anon", port: 3101, cookie: null },
    { name: "customer", port: 3102, cookie: customer },
    { name: "agentPending", port: 3103, cookie: agentPending },
    { name: "agent", port: 3104, cookie: agentFull },
  ];
  const stops = await Promise.all(personas.map(startProxy));
  const portOf = Object.fromEntries(personas.map((p) => [p.name, p.port]));

  const loan = await db.loan.findFirstOrThrow();
  const docsApp = await db.application.findFirstOrThrow({ where: { state: "DOCS_REQUIRED" } });
  const referApp = await db.application.findFirstOrThrow({ where: { state: "ELIGIBILITY_RESULT" } });

  const shots: { file: string; persona: string; path: string; size: string; dark?: boolean }[] = [
    // Sized close to actual content height: body carries a min-h-screen
    // sticky-footer pattern, so a much taller window would stretch blank
    // space in above the footer — a capture artifact, not a page bug.
    { file: "01-landing-de", persona: "anon", path: "/de", size: "1440,4950" },
    { file: "02-landing-de-dark", persona: "anon", path: "/de", size: "1440,1500", dark: true },
    { file: "04-mfa-setup", persona: "agentPending", path: "/de/mfa/setup", size: "1100,1400" },
    { file: "05-offers", persona: "customer", path: `/de/apply/${docsApp.id}/offers`, size: "1440,2100" },
    { file: "05b-offers-dark", persona: "customer", path: `/de/apply/${docsApp.id}/offers`, size: "1440,2100", dark: true },
    { file: "06-loan", persona: "customer", path: `/de/account/loan/${loan.id}`, size: "1200,1700" },
    { file: "07-backoffice-queue", persona: "agent", path: "/de/backoffice", size: "1440,1000" },
    { file: "08-backoffice-detail", persona: "agent", path: `/de/backoffice/applications/${referApp.id}`, size: "1440,2000" },
    { file: "09-backoffice-kpi", persona: "agent", path: "/de/backoffice/kpi", size: "1440,1100" },
    { file: "10-security", persona: "customer", path: "/de/account/security", size: "1100,700" },
  ];

  for (const shot of shots) {
    const url = `http://127.0.0.1:${portOf[shot.persona]}${shot.path}`;
    const file = join(OUT, `${shot.file}.png`);
    await shoot(url, file, shot.size, shot.dark ?? false);
    console.log(`${shot.file}.png`);
  }

  stops.forEach((stop) => stop());
  console.log(`\nWritten to ${OUT}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
