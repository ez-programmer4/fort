/*
  Warnings:

  - Added the required column `updatedAt` to the `Customer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "country" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "withholdingTaxApplicable" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CustomerAuditLog" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "reason" TEXT,
    "changedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerAuditLog_customerId_createdAt_idx" ON "CustomerAuditLog"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomerAuditLog" ADD CONSTRAINT "CustomerAuditLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAuditLog" ADD CONSTRAINT "CustomerAuditLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
