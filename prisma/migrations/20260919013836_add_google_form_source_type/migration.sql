-- AlterEnum
ALTER TYPE "DocumentSourceType" ADD VALUE 'GOOGLE_FORM';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "sourceUrl" TEXT;
