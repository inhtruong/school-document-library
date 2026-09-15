import { describe, expect, test } from "vitest";
import vi from "@/i18n/messages/vi.json";
import en from "@/i18n/messages/en.json";

/** Recursively collects every leaf key path (e.g. "toast.loggedIn") from a nested messages object. */
function collectKeyPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "object" && value !== null
      ? collectKeyPaths(value as Record<string, unknown>, path)
      : [path];
  });
}

describe("FEAT-13: locale message files — structural parity", () => {
  test("vi and en define exactly the same set of keys — no missing/extra translations", () => {
    const viKeys = collectKeyPaths(vi).sort();
    const enKeys = collectKeyPaths(en).sort();
    expect(viKeys).toEqual(enKeys);
  });

  test("every leaf value in both locale files is a non-empty string", () => {
    for (const [locale, messages] of [
      ["vi", vi],
      ["en", en],
    ] as const) {
      for (const path of collectKeyPaths(messages)) {
        const value = path.split(".").reduce<unknown>((acc, key) => (acc as Record<string, unknown>)[key], messages);
        expect(typeof value, `${locale}.${path} should be a string`).toBe("string");
        expect((value as string).length, `${locale}.${path} should not be empty`).toBeGreaterThan(0);
      }
    }
  });
});

describe("FEAT-13: shared Vietnamese messages", () => {
  test("default toast/auth/navigation copy reads in Vietnamese", () => {
    expect(vi.auth.login).toBe("Đăng nhập");
    expect(vi.auth.logout).toBe("Đăng xuất");
    expect(vi.navigation.documents).toBe("Tài liệu");
    expect(vi.toast.loggedOut).toMatch(/đăng xuất/i);
  });

  test("the pending-review upload message does not imply immediate publication (vi)", () => {
    expect(vi.toast.uploadPendingReview).toMatch(/chờ duyệt/i);
  });
});

describe("FEAT-13: shared English messages", () => {
  test("default toast/auth/navigation copy reads in English", () => {
    expect(en.auth.login).toBe("Log in");
    expect(en.auth.logout).toBe("Log out");
    expect(en.navigation.documents).toBe("Documents");
    expect(en.toast.loggedOut).toMatch(/logged out/i);
  });

  test("the pending-review upload message does not imply immediate publication (en)", () => {
    expect(en.toast.uploadPendingReview).toMatch(/pending review/i);
  });
});

describe("FEAT-13: language switcher option labels", () => {
  test("language names are shown in their own native form in BOTH locale files (not translated)", () => {
    expect(vi.language.vietnamese).toBe("Tiếng Việt");
    expect(vi.language.english).toBe("English");
    expect(en.language.vietnamese).toBe("Tiếng Việt");
    expect(en.language.english).toBe("English");
  });
});

describe("FEAT-15A: Admin dashboard messages", () => {
  test("Vietnamese admin dashboard copy reads in Vietnamese", () => {
    expect(vi.admin.dashboardTitle).toBe("Quản trị");
    expect(vi.admin.nav.dashboard).toMatch(/tổng quan/i);
    expect(vi.admin.dashboard.pendingModeration).toMatch(/chờ duyệt/i);
    expect(vi.admin.dashboard.noItemsPending).toMatch(/chờ duyệt/i);
    expect(vi.admin.dashboard.noRecentActivity).toMatch(/hoạt động/i);
  });

  test("English admin dashboard copy reads in English", () => {
    expect(en.admin.dashboardTitle).toBe("Admin");
    expect(en.admin.nav.dashboard).toBe("Dashboard");
    expect(en.admin.dashboard.pendingModeration).toMatch(/pending/i);
    expect(en.admin.dashboard.noItemsPending).toMatch(/waiting for review/i);
    expect(en.admin.dashboard.noRecentActivity).toMatch(/no activity/i);
  });

  test("both locales define every file-type label the dashboard displays", () => {
    const expectedKeys = ["pdf", "word", "excel", "image", "video", "powerpoint", "youtube"].sort();
    expect(Object.keys(vi.admin.dashboard.fileTypes).sort()).toEqual(expectedKeys);
    expect(Object.keys(en.admin.dashboard.fileTypes).sort()).toEqual(expectedKeys);
  });
});

describe("FEAT-13: footer copyright interpolation", () => {
  test("both locales' copyright message carries a {year} placeholder for ICU interpolation", () => {
    expect(vi.footer.copyright).toContain("{year}");
    expect(en.footer.copyright).toContain("{year}");
  });
});
