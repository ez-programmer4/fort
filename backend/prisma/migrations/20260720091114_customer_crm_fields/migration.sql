-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "addressDetails" TEXT,
ADD COLUMN     "altPhone" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "classification" TEXT,
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "creditLimit" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "tags" JSONB NOT NULL DEFAULT '[]';
