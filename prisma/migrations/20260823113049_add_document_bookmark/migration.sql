-- CreateTable
CREATE TABLE "DocumentBookmark" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentBookmark_documentId_idx" ON "DocumentBookmark"("documentId");

-- CreateIndex
CREATE INDEX "DocumentBookmark_userId_idx" ON "DocumentBookmark"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentBookmark_documentId_userId_key" ON "DocumentBookmark"("documentId", "userId");

-- AddForeignKey
ALTER TABLE "DocumentBookmark" ADD CONSTRAINT "DocumentBookmark_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentBookmark" ADD CONSTRAINT "DocumentBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
