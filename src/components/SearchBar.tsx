"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SearchBarProps = {
  /** Pre-fills the input, e.g. when coming back to a results page. */
  defaultValue?: string;
  size?: "large" | "compact";
};

export default function SearchBar({ defaultValue = "", size = "large" }: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(defaultValue);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Preserve any active filters/sort (from the current URL) — only the
    // keyword and page reset on a new search.
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = query.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    params.delete("page");

    const queryString = params.toString();
    router.push(queryString ? `/search?${queryString}` : "/search");
  }

  const isLarge = size === "large";

  return (
    <form onSubmit={handleSubmit} role="search" className="w-full">
      <label htmlFor="document-search" className="sr-only">
        Search documents
      </label>

      <div
        className={`flex w-full items-center gap-2 rounded-xl border border-line bg-paper transition-colors focus-within:border-accent ${
          isLarge ? "p-2 shadow-sm sm:gap-3" : "p-1.5"
        }`}
      >
        <span aria-hidden className={`pl-2 text-muted ${isLarge ? "sm:pl-3" : ""}`}>
          <svg
            width={isLarge ? 20 : 18}
            height={isLarge ? 20 : 18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2" />
          </svg>
        </span>

        <Input
          id="document-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search documents, subjects, exams..."
          autoComplete="off"
          className={`h-auto min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 ${
            isLarge ? "py-2 text-base sm:text-lg" : "py-1.5 text-sm sm:text-base"
          }`}
        />

        <Button type="submit" size={isLarge ? "default" : "sm"} className={isLarge ? "sm:px-6" : ""}>
          Search
        </Button>
      </div>
    </form>
  );
}
