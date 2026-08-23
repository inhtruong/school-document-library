"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { FollowedTeacher } from "@/lib/follow/teacher-follow";

type FollowedTeachersListProps = {
  initialTeachers: FollowedTeacher[];
};

/**
 * `/following` always renders this only for the signed-in user's own
 * list, so there's no guest branch here (the page itself redirects
 * guests away first). Unfollowing removes the item from the currently
 * displayed page immediately — pagination (which page to view) stays
 * server-driven via the URL, matching `/saved`/`/search`.
 */
export function FollowedTeachersList({ initialTeachers }: FollowedTeachersListProps) {
  const [teachers, setTeachers] = useState(initialTeachers);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleUnfollow(teacherId: string) {
    if (removingId) return;
    setRemovingId(teacherId);

    try {
      const response = await fetch(`/api/teachers/${teacherId}/follow`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? "Failed to unfollow");

      setTeachers((prev) => prev.filter((teacher) => teacher.id !== teacherId));
      toast.success("Teacher unfollowed");
    } catch {
      toast.error("Unable to update follow status");
    } finally {
      setRemovingId(null);
    }
  }

  if (teachers.length === 0) {
    return (
      <p className="text-sm text-muted">
        You are not following any teachers yet.{" "}
        <Link href="/search" className="font-medium text-ink underline underline-offset-2 hover:text-accent">
          Browse documents
        </Link>
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {teachers.map((teacher) => (
        <li key={teacher.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{teacher.name}</p>
            <p className="text-xs text-muted">
              {teacher.documentCount} {teacher.documentCount === 1 ? "document" : "documents"}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={removingId === teacher.id}
            onClick={() => handleUnfollow(teacher.id)}
          >
            Unfollow
          </Button>
        </li>
      ))}
    </ul>
  );
}
