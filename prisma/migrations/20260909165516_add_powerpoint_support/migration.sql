-- AlterEnum
ALTER TYPE "FileCategory" ADD VALUE 'POWERPOINT';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "previewFileKey" TEXT;
