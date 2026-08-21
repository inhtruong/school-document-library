-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('PDF', 'WORD', 'EXCEL', 'IMAGE', 'VIDEO');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "fileCategory" "FileCategory";
