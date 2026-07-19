-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "licenseDocument" JSONB,
ADD COLUMN     "licenseNumber" TEXT,
ADD COLUMN     "tin" TEXT;
