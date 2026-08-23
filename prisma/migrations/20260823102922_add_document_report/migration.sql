-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('BROKEN_FILE', 'WRONG_CONTENT', 'WRONG_TAXONOMY', 'PREVIEW_ISSUE', 'DUPLICATE_DOCUMENT', 'COPYRIGHT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "DocumentReport" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentReport_documentId_idx" ON "DocumentReport"("documentId");

-- CreateIndex
CREATE INDEX "DocumentReport_userId_idx" ON "DocumentReport"("userId");

-- CreateIndex
CREATE INDEX "DocumentReport_status_idx" ON "DocumentReport"("status");

-- AddForeignKey
ALTER TABLE "DocumentReport" ADD CONSTRAINT "DocumentReport_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReport" ADD CONSTRAINT "DocumentReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial unique index: at most one OPEN report per (documentId, userId, reason).
-- Prisma's schema DSL can't express a WHERE clause on @@unique, so this is
-- hand-written. A RESOLVED/DISMISSED report never blocks a new OPEN one for
-- the same combination, since the index only covers status = 'OPEN' rows.
CREATE UNIQUE INDEX "DocumentReport_documentId_userId_reason_open_key" ON "DocumentReport"("documentId", "userId", "reason") WHERE "status" = 'OPEN';
