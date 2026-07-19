-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "bankAccounts" JSONB NOT NULL DEFAULT '[]';
