-- CreateTable
CREATE TABLE "DocumentRating" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentRating_documentId_idx" ON "DocumentRating"("documentId");

-- CreateIndex
CREATE INDEX "DocumentRating_userId_idx" ON "DocumentRating"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRating_documentId_userId_key" ON "DocumentRating"("documentId", "userId");

-- AddForeignKey
ALTER TABLE "DocumentRating" ADD CONSTRAINT "DocumentRating_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRating" ADD CONSTRAINT "DocumentRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
