-- CreateEnum
CREATE TYPE "DocumentModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "moderationStatus" "DocumentModerationStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- CreateIndex
CREATE INDEX "Document_reviewedById_idx" ON "Document"("reviewedById");

-- CreateIndex
CREATE INDEX "Document_moderationStatus_createdAt_idx" ON "Document"("moderationStatus", "createdAt");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
