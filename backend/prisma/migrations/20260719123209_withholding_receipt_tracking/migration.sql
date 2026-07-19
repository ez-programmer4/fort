-- AlterTable
ALTER TABLE "DispenseOrder" ADD COLUMN     "withholdingReceiptNumber" TEXT,
ADD COLUMN     "withholdingReceivedAt" TIMESTAMP(3);
