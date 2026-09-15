-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'GRADE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'GRADE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'GRADE_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBJECT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBJECT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBJECT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'LESSON_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LESSON_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'LESSON_DELETED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntityType" ADD VALUE 'GRADE';
ALTER TYPE "AuditEntityType" ADD VALUE 'SUBJECT';
ALTER TYPE "AuditEntityType" ADD VALUE 'LESSON';
