"use client";

import Link from "next/link";
import { useState } from "react";
import { UserMinus, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface p-8 text-center">
        <UserX className="h-5 w-5 text-muted" aria-hidden />
        <p className="text-sm text-muted">
          You are not following any teachers yet.{" "}
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
        {teachers.map((teacher) => (
          <li key={teacher.id} className="flex items-center gap-3 px-4 py-3">
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
            >
              {teacher.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
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
              <UserMinus className="h-3.5 w-3.5" aria-hidden />
              Unfollow
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
