-- CreateEnum
CREATE TYPE "DocumentSourceType" AS ENUM ('FILE', 'YOUTUBE');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "externalVideoId" TEXT,
ADD COLUMN     "sourceType" "DocumentSourceType" NOT NULL DEFAULT 'FILE';
