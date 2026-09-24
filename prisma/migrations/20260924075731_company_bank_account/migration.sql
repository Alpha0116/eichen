/*
  Warnings:

  - You are about to drop the `AccountSpaceSettings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "AccountSpaceSettings";

-- CreateTable
CREATE TABLE "CompanyBankAccount" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "accountHolder" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "bic" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "CompanyBankAccount_pkey" PRIMARY KEY ("id")
);
