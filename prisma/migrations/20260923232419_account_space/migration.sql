-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "transferCode" TEXT,
ADD COLUMN     "transferCodeAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "transferRequestedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AccountSpaceSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "bankName" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "bic" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "cardExpiry" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "AccountSpaceSettings_pkey" PRIMARY KEY ("id")
);
