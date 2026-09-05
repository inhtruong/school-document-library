"use client";

import Link from "next/link";
import { useState } from "react";
import { BellOff, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { FollowedLesson } from "@/lib/follow/lesson-follow";

type FollowedLessonsListProps = {
  initialLessons: FollowedLesson[];
};

export function FollowedLessonsList({ initialLessons }: FollowedLessonsListProps) {
  const [lessons, setLessons] = useState(initialLessons);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleUnfollow(lessonId: string) {
    if (removingId) return;
    setRemovingId(lessonId);

    try {
      const response = await fetch(`/api/lessons/${lessonId}/follow`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to unfollow");

      setLessons((prev) => prev.filter((lesson) => lesson.id !== lessonId));
      toast.success("Lesson unfollowed");
    } catch {
      toast.error("Unable to update follow status");
    } finally {
      setRemovingId(null);
    }
  }

  if (lessons.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface p-8 text-center">
        <BellOff className="h-5 w-5 text-muted" aria-hidden />
        <p className="text-sm text-muted">
          You are not following any lessons yet.{" "}
          <Link href="/search" className="font-medium text-ink underline underline-offset-2 hover:text-accent">
            Browse documents
          </Link>
        </p>
      </div>
    );
  }

  return (
    <Card className="divide-y divide-line overflow-hidden p-0">
      <ul>
        {lessons.map((lesson) => (
          <li key={lesson.id} className="flex items-center gap-3 px-4 py-3">
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
            >
              <BookOpen className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{lesson.name}</p>
              <p className="text-xs text-muted">
                {lesson.gradeName} · {lesson.subjectName}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={removingId === lesson.id}
              onClick={() => handleUnfollow(lesson.id)}
            >
              <BellOff className="h-3.5 w-3.5" aria-hidden />
              Unfollow
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
