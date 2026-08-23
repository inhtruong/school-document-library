"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type StarRatingProps = {
  /** Current value to display (0-5) when not hovering — a user's own rating, or a rounded average for read-only display. */
  value: number;
  /** Omit for a read-only display (e.g. showing the average to a guest); provide to make the stars clickable. */
  onRate?: (value: number) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  label?: string;
};

const STAR_VALUES = [1, 2, 3, 4, 5] as const;
const SIZE_CLASSES = { sm: "h-4 w-4", md: "h-6 w-6" } as const;

/**
 * Five stars, either read-only (no `onRate`) or interactive. Interactive
 * stars are real `<button>`s in a `radiogroup` (a rating is a single choice
 * among 5 discrete values, not five independent toggles) — keyboard focus +
 * Enter/Space works natively, and `onFocus` mirrors hover so keyboard users
 * get the same "preview" feedback mouse users get.
 */
export function StarRating({ value, onRate, disabled = false, size = "md", label = "Rate this document" }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const isInteractive = Boolean(onRate) && !disabled;
  const displayValue = hoverValue ?? value;
  const starClassName = SIZE_CLASSES[size];

  if (!isInteractive) {
    return (
      <div className="inline-flex items-center gap-0.5">
        {STAR_VALUES.map((star) => (
          <Star
            key={star}
            aria-hidden
            className={cn(starClassName, star <= Math.round(displayValue) ? "fill-amber-400 text-amber-400" : "fill-none text-line")}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex items-center gap-0.5"
      onMouseLeave={() => setHoverValue(null)}
    >
      {STAR_VALUES.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={star === value}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
          disabled={disabled}
          onMouseEnter={() => setHoverValue(star)}
          onFocus={() => setHoverValue(star)}
          onBlur={() => setHoverValue(null)}
          onClick={() => onRate?.(star)}
          className="rounded p-0.5 outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Star
            className={cn(starClassName, star <= Math.round(displayValue) ? "fill-amber-400 text-amber-400" : "fill-none text-line")}
          />
        </button>
      ))}
    </div>
  );
}
