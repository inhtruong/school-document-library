-- CreateTable
CREATE TABLE "TeacherFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherFollow_followerId_idx" ON "TeacherFollow"("followerId");

-- CreateIndex
CREATE INDEX "TeacherFollow_teacherId_idx" ON "TeacherFollow"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherFollow_followerId_teacherId_key" ON "TeacherFollow"("followerId", "teacherId");

-- CreateIndex
CREATE INDEX "LessonFollow_userId_idx" ON "LessonFollow"("userId");

-- CreateIndex
CREATE INDEX "LessonFollow_lessonId_idx" ON "LessonFollow"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonFollow_userId_lessonId_key" ON "LessonFollow"("userId", "lessonId");

-- AddForeignKey
ALTER TABLE "TeacherFollow" ADD CONSTRAINT "TeacherFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherFollow" ADD CONSTRAINT "TeacherFollow_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonFollow" ADD CONSTRAINT "LessonFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonFollow" ADD CONSTRAINT "LessonFollow_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
