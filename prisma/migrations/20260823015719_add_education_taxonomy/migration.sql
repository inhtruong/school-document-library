-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('LECTURE', 'EXERCISE', 'EXAM', 'ANSWER', 'REFERENCE', 'OTHER');

-- AlterTable: add new taxonomy FK columns (additive, safe)
ALTER TABLE "Document" ADD COLUMN "gradeId" TEXT;
ALTER TABLE "Document" ADD COLUMN "subjectId" TEXT;
ALTER TABLE "Document" ADD COLUMN "lessonId" TEXT;

-- AlterTable: convert documentType from free-text to the controlled enum
-- WITHOUT dropping the column, so existing values are preserved via an
-- explicit mapping rather than replaced with the default.
ALTER TABLE "Document"
  ALTER COLUMN "documentType" TYPE "DocumentType" USING (
    CASE "documentType"
      WHEN 'Exam' THEN 'EXAM'
      WHEN 'Test' THEN 'EXAM'
      WHEN 'Lecture Notes' THEN 'LECTURE'
      WHEN 'Assignment' THEN 'EXERCISE'
      WHEN 'Worksheet' THEN 'EXERCISE'
      WHEN 'Cheatsheet' THEN 'REFERENCE'
      WHEN 'Answer Key' THEN 'ANSWER'
      ELSE 'OTHER'
    END
  )::"DocumentType";

ALTER TABLE "Document" ALTER COLUMN "documentType" SET DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Grade_code_key" ON "Grade"("code");

-- CreateIndex
CREATE INDEX "Grade_sortOrder_idx" ON "Grade"("sortOrder");

-- CreateIndex
CREATE INDEX "Subject_gradeId_idx" ON "Subject"("gradeId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_gradeId_code_key" ON "Subject"("gradeId", "code");

-- CreateIndex
CREATE INDEX "Lesson_subjectId_idx" ON "Lesson"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_subjectId_code_key" ON "Lesson"("subjectId", "code");

-- Document_documentType_idx already exists from before this migration and
-- is automatically rebuilt by the ALTER COLUMN TYPE above — not recreated here.

-- CreateIndex
CREATE INDEX "Document_gradeId_idx" ON "Document"("gradeId");

-- CreateIndex
CREATE INDEX "Document_subjectId_idx" ON "Document"("subjectId");

-- CreateIndex
CREATE INDEX "Document_lessonId_idx" ON "Document"("lessonId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
