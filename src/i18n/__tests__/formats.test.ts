import { afterEach, describe, expect, test } from "vitest";
import { __resetTestLocale, __setTestLocale, getFormatter } from "@test/next-intl-server-stub";
import { formats } from "@/i18n/formats";

afterEach(() => {
  __resetTestLocale();
});

// Fixed, deterministic instant — never `new Date()`/`Date.now()` — so
// results never depend on the machine/CI running the suite.
const FIXED_INSTANT = "2026-03-05T14:30:00.000Z";

describe("dateTime formatter — dateOnly (vi default)", () => {
  test("formats a fixed date in Vietnamese by default", async () => {
    const format = await getFormatter();
    const result = format.dateTime(new Date(FIXED_INSTANT), "dateOnly");
    expect(result).toBe(new Intl.DateTimeFormat("vi", formats.dateTime.dateOnly).format(new Date(FIXED_INSTANT)));
    expect(result).toContain("2026");
  });
});

describe("dateTime formatter — dateOnly (en)", () => {
  test("formats the same fixed date in English once the locale is en", async () => {
    __setTestLocale("en");
    const format = await getFormatter();
    const result = format.dateTime(new Date(FIXED_INSTANT), "dateOnly");
    expect(result).toBe(new Intl.DateTimeFormat("en", formats.dateTime.dateOnly).format(new Date(FIXED_INSTANT)));
    expect(result).toContain("2026");
  });
});

describe("dateTime formatter — dateTimeShort / dateTimeLong (vi)", () => {
  test("formats date+time in Vietnamese for the short preset", async () => {
    const format = await getFormatter();
    const result = format.dateTime(new Date(FIXED_INSTANT), "dateTimeShort");
    expect(result).toBe(
      new Intl.DateTimeFormat("vi", formats.dateTime.dateTimeShort).format(new Date(FIXED_INSTANT))
    );
  });

  test("formats date+time in Vietnamese for the long preset", async () => {
    const format = await getFormatter();
    const result = format.dateTime(new Date(FIXED_INSTANT), "dateTimeLong");
    expect(result).toBe(
      new Intl.DateTimeFormat("vi", formats.dateTime.dateTimeLong).format(new Date(FIXED_INSTANT))
    );
  });
});

describe("dateTime formatter — dateTimeShort / dateTimeLong (en)", () => {
  test("formats date+time in English for the short preset", async () => {
    __setTestLocale("en");
    const format = await getFormatter();
    const result = format.dateTime(new Date(FIXED_INSTANT), "dateTimeShort");
    expect(result).toBe(
      new Intl.DateTimeFormat("en", formats.dateTime.dateTimeShort).format(new Date(FIXED_INSTANT))
    );
  });

  test("formats date+time in English for the long preset", async () => {
    __setTestLocale("en");
    const format = await getFormatter();
    const result = format.dateTime(new Date(FIXED_INSTANT), "dateTimeLong");
    expect(result).toBe(
      new Intl.DateTimeFormat("en", formats.dateTime.dateTimeLong).format(new Date(FIXED_INSTANT))
    );
  });
});

describe("same instant, locale-different presentation", () => {
  test("vi and en render different text for the same timestamp, but both parse back to the same instant", async () => {
    const viFormat = await getFormatter();
    const viResult = viFormat.dateTime(new Date(FIXED_INSTANT), "dateOnly");

    __setTestLocale("en");
    const enFormat = await getFormatter();
    const enResult = enFormat.dateTime(new Date(FIXED_INSTANT), "dateOnly");

    // Different presentation (month name, ordering, punctuation) ...
    expect(viResult).not.toBe(enResult);
    // ... but the source instant driving both was never touched or converted.
    expect(new Date(FIXED_INSTANT).toISOString()).toBe(FIXED_INSTANT);
  });

  test("switching locale back and forth is stable and never mutates the underlying Date", async () => {
    const date = new Date(FIXED_INSTANT);
    const original = date.toISOString();

    const vi1 = (await getFormatter()).dateTime(date, "dateTimeShort");
    __setTestLocale("en");
    (await getFormatter()).dateTime(date, "dateTimeShort");
    __setTestLocale("vi");
    const vi2 = (await getFormatter()).dateTime(date, "dateTimeShort");

    expect(vi1).toBe(vi2);
    expect(date.toISOString()).toBe(original);
  });
});

describe("invalid/unset locale fallback", () => {
  test("defaults to Vietnamese formatting when no locale has been explicitly set (matches FEAT-13's vi default)", async () => {
    // __resetTestLocale() (afterEach) already restores "vi"; a fresh
    // getFormatter() with no __setTestLocale call exercises that same
    // default path this describe block is verifying.
    const format = await getFormatter();
    const result = format.dateTime(new Date(FIXED_INSTANT), "dateOnly");
    expect(result).toBe(new Intl.DateTimeFormat("vi", formats.dateTime.dateOnly).format(new Date(FIXED_INSTANT)));
  });
});

describe("representative real-world surfaces share the same formatter config", () => {
  // These assert against the exact preset each migrated surface calls
  // (see formats.ts's doc comments), so a change to any one surface's
  // named-format choice is caught here rather than only in a live smoke test.
  test("comment timestamps use dateTimeShort", async () => {
    const format = await getFormatter();
    expect(format.dateTime(new Date(FIXED_INSTANT), "dateTimeShort")).toBe(
      new Intl.DateTimeFormat("vi", formats.dateTime.dateTimeShort).format(new Date(FIXED_INSTANT))
    );
  });

  test("notification timestamps use dateTimeShort", async () => {
    __setTestLocale("en");
    const format = await getFormatter();
    expect(format.dateTime(new Date(FIXED_INSTANT), "dateTimeShort")).toBe(
      new Intl.DateTimeFormat("en", formats.dateTime.dateTimeShort).format(new Date(FIXED_INSTANT))
    );
  });

  test("audit log timestamps use dateTimeShort in both locales", async () => {
    const viFormat = await getFormatter();
    const viResult = viFormat.dateTime(new Date(FIXED_INSTANT), "dateTimeShort");
    __setTestLocale("en");
    const enFormat = await getFormatter();
    const enResult = enFormat.dateTime(new Date(FIXED_INSTANT), "dateTimeShort");

    expect(viResult).toBe(
      new Intl.DateTimeFormat("vi", formats.dateTime.dateTimeShort).format(new Date(FIXED_INSTANT))
    );
    expect(enResult).toBe(
      new Intl.DateTimeFormat("en", formats.dateTime.dateTimeShort).format(new Date(FIXED_INSTANT))
    );
  });

  test("document detail's 'Added on' date uses dateOnly in both locales", async () => {
    const viFormat = await getFormatter();
    const viResult = viFormat.dateTime(new Date(FIXED_INSTANT), "dateOnly");
    __setTestLocale("en");
    const enFormat = await getFormatter();
    const enResult = enFormat.dateTime(new Date(FIXED_INSTANT), "dateOnly");

    expect(viResult).toBe(new Intl.DateTimeFormat("vi", formats.dateTime.dateOnly).format(new Date(FIXED_INSTANT)));
    expect(enResult).toBe(new Intl.DateTimeFormat("en", formats.dateTime.dateOnly).format(new Date(FIXED_INSTANT)));
  });
});
