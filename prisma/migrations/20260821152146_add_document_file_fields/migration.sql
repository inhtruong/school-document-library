-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "fileKey" TEXT,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "uploadedById" TEXT;

-- CreateIndex
CREATE INDEX "Document_uploadedById_idx" ON "Document"("uploadedById");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
