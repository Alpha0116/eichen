-- CreateTable
CREATE TABLE "AccountFee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "providerReference" TEXT,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueBy" DATETIME NOT NULL,
    "paidAt" DATETIME,
    CONSTRAINT "AccountFee_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "userId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "country" TEXT NOT NULL DEFAULT 'DE',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "locale" TEXT NOT NULL DEFAULT 'de',
    "amount" INTEGER NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "grantedAmount" INTEGER,
    "schufaOptIn" BOOLEAN NOT NULL DEFAULT false,
    "bankName" TEXT,
    "maskedIban" TEXT,
    "resumeTokenHash" TEXT,
    "expiresAt" DATETIME,
    "ruleSetKey" TEXT,
    "ruleSetVersion" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "submittedAt" DATETIME,
    "decidedAt" DATETIME,
    CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Application" ("amount", "country", "createdAt", "currency", "decidedAt", "expiresAt", "grantedAmount", "id", "locale", "purpose", "reference", "resumeTokenHash", "ruleSetKey", "ruleSetVersion", "state", "submittedAt", "termMonths", "updatedAt", "userId") SELECT "amount", "country", "createdAt", "currency", "decidedAt", "expiresAt", "grantedAmount", "id", "locale", "purpose", "reference", "resumeTokenHash", "ruleSetKey", "ruleSetVersion", "state", "submittedAt", "termMonths", "updatedAt", "userId" FROM "Application";
DROP TABLE "Application";
ALTER TABLE "new_Application" RENAME TO "Application";
CREATE UNIQUE INDEX "Application_reference_key" ON "Application"("reference");
CREATE UNIQUE INDEX "Application_resumeTokenHash_key" ON "Application"("resumeTokenHash");
CREATE INDEX "Application_userId_idx" ON "Application"("userId");
CREATE INDEX "Application_state_idx" ON "Application"("state");
CREATE INDEX "Application_createdAt_idx" ON "Application"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AccountFee_applicationId_key" ON "AccountFee"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountFee_reference_key" ON "AccountFee"("reference");

-- CreateIndex
CREATE INDEX "AccountFee_status_idx" ON "AccountFee"("status");
