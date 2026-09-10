-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "locale" TEXT NOT NULL DEFAULT 'de',
    "firstName" TEXT,
    "lastName" TEXT,
    "mfaSecret" TEXT,
    "mfaPendingSecret" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaEnrolledAt" DATETIME,
    "mfaLastStep" INTEGER,
    "mfaFailedAttempts" INTEGER NOT NULL DEFAULT 0,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME
);
INSERT INTO "new_User" ("createdAt", "email", "failedLogins", "firstName", "id", "lastLoginAt", "lastName", "locale", "lockedUntil", "mfaEnabled", "mfaEnrolledAt", "mfaFailedAttempts", "mfaLastStep", "mfaPendingSecret", "mfaSecret", "passwordHash", "role") SELECT "createdAt", "email", "failedLogins", "firstName", "id", "lastLoginAt", "lastName", "locale", "lockedUntil", "mfaEnabled", "mfaEnrolledAt", "mfaFailedAttempts", "mfaLastStep", "mfaPendingSecret", "mfaSecret", "passwordHash", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
