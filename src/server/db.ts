import { PrismaClient } from "../generated/prisma";

/**
 * Prisma client, cached across hot reloads.
 *
 * Next.js re-evaluates modules on every change in development; a new
 * PrismaClient per reload exhausts the connection pool within minutes.
 */
const globalForPrisma = globalThis as unknown as { __eichenPrisma?: PrismaClient };

export const db =
  globalForPrisma.__eichenPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.__eichenPrisma = db;
