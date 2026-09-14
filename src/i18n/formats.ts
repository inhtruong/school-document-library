import type { Formats } from "next-intl";

/**
 * I18N-2: the app's only three date/time presentations, discovered by
 * auditing every existing `toLocaleDateString`/`toLocaleString`/
 * `Intl.DateTimeFormat("en-US", ...)` call site — no new shapes invented.
 * Registered here (not scattered per-component) so `format.dateTime(date,
 * "dateOnly")` resolves consistently everywhere, and so the shape is
 * type-checked via the `AppConfig.Formats` augmentation in
 * `src/types/next-intl.d.ts`. Deliberately no explicit `timeZone` — matching
 * every one of those call sites exactly, none of which ever specified one
 * either (see the I18N-2 report's timezone section).
 */
export const formats = {
  dateTime: {
    /** e.g. "January 15, 2026" / "15 tháng 1, 2026" — profile member-since, document detail's "Added" date. */
    dateOnly: { year: "numeric", month: "long", day: "numeric" },
    /** e.g. "Jan 15, 2026, 3:45 PM" / "15 thg 1, 2026, 15:45" — comments, notifications, my-uploads, audit log, moderation list. */
    dateTimeShort: { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
    /** e.g. "January 15, 2026, 3:45 PM" — moderation detail's uploaded/reviewed timestamps. */
    dateTimeLong: { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" },
  },
} satisfies Formats;

/**
 * Structural type for the object `getFormatter()` (Server) / `useFormatter()`
 * (Client) both resolve to — confirmed identical via
 * `ReturnType<typeof createFormatter>` in next-intl's own shipped types.
 * Declared narrowly (just the one method every call site here actually
 * uses) so module-level helper functions can accept it as a plain parameter
 * without importing next-intl's server/client entry points into files that
 * don't otherwise need them.
 */
export type DateTimeFormatter = {
  dateTime(value: Date, format?: keyof typeof formats.dateTime): string;
};
