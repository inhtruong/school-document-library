"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
      <p className="text-sm text-muted">
        You are not following any lessons yet.{" "}
        <Link href="/search" className="font-medium text-ink underline underline-offset-2 hover:text-accent">
          Browse documents
        </Link>
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {lessons.map((lesson) => (
        <li key={lesson.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
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
            Unfollow
          </Button>
        </li>
      ))}
    </ul>
  );
}
