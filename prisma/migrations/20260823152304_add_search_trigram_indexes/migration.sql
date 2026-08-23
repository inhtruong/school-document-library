-- Required for the gin_trgm_ops operator class used by the trigram indexes below.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "Document_title_trgm_idx" ON "Document" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Document_description_trgm_idx" ON "Document" USING GIN ("description" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Document_subject_trgm_idx" ON "Document" USING GIN ("subject" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Lesson_name_trgm_idx" ON "Lesson" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Subject_name_trgm_idx" ON "Subject" USING GIN ("name" gin_trgm_ops);
