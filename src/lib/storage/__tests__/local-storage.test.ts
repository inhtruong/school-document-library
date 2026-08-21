import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  buildFileKey,
  deleteLocalFile,
  matchesFileSignature,
  resolveFileFormat,
  resolveStoragePath,
  writeLocalFile,
} from "@/lib/storage/local-storage";

let testRoot: string;

beforeAll(async () => {
  testRoot = await mkdtemp(path.join(tmpdir(), "stacks-storage-test-"));
  process.env.STORAGE_LOCAL_ROOT = testRoot;
});

afterAll(async () => {
  delete process.env.STORAGE_LOCAL_ROOT;
  await rm(testRoot, { recursive: true, force: true });
});

describe("resolveFileFormat", () => {
  test.each([
    ["report.pdf", "application/pdf", "PDF"],
    ["notes.doc", "application/msword", "WORD"],
    ["notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "WORD"],
    ["sheet.xls", "application/vnd.ms-excel", "EXCEL"],
    ["sheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "EXCEL"],
    ["photo.jpg", "image/jpeg", "IMAGE"],
    ["photo.jpeg", "image/jpeg", "IMAGE"],
    ["photo.png", "image/png", "IMAGE"],
    ["photo.webp", "image/webp", "IMAGE"],
    ["clip.mp4", "video/mp4", "VIDEO"],
    ["clip.webm", "video/webm", "VIDEO"],
  ] as const)("accepts %s (%s) as %s", (fileName, mimeType, category) => {
    const result = resolveFileFormat(fileName, mimeType);
    expect(result).toEqual({ valid: true, category, extension: path.extname(fileName) });
  });

  test("rejects an unsupported extension", () => {
    expect(resolveFileFormat("archive.zip", "application/zip").valid).toBe(false);
  });

  test("rejects an extension/MIME mismatch", () => {
    expect(resolveFileFormat("report.pdf", "image/png").valid).toBe(false);
  });

  test("is not fooled by the filename alone when the MIME type disagrees", () => {
    const result = resolveFileFormat("totally-a-video.mp4", "text/plain");
    expect(result.valid).toBe(false);
  });
});

describe("matchesFileSignature", () => {
  test("accepts a real PDF signature", () => {
    expect(matchesFileSignature(Buffer.from("%PDF-1.4\nrest of file"), ".pdf")).toBe(true);
  });

  test("rejects content that doesn't match the PDF signature", () => {
    expect(matchesFileSignature(Buffer.from("this is not a pdf"), ".pdf")).toBe(false);
  });

  test("accepts a real PNG signature", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    expect(matchesFileSignature(png, ".png")).toBe(true);
  });

  test("accepts a zip-based docx/xlsx signature", () => {
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]);
    expect(matchesFileSignature(zip, ".docx")).toBe(true);
    expect(matchesFileSignature(zip, ".xlsx")).toBe(true);
  });

  test("accepts a real OLE compound file signature for legacy .doc/.xls", () => {
    const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    expect(matchesFileSignature(ole, ".doc")).toBe(true);
    expect(matchesFileSignature(ole, ".xls")).toBe(true);
  });
});

describe("buildFileKey", () => {
  test("scopes the key under the right category folder with a generated file name", () => {
    expect(buildFileKey("PDF", ".pdf")).toMatch(/^pdf\/[0-9a-f-]{36}\.pdf$/);
    expect(buildFileKey("WORD", ".docx")).toMatch(/^word\/[0-9a-f-]{36}\.docx$/);
    expect(buildFileKey("EXCEL", ".xlsx")).toMatch(/^excel\/[0-9a-f-]{36}\.xlsx$/);
    expect(buildFileKey("IMAGE", ".png")).toMatch(/^images\/[0-9a-f-]{36}\.png$/);
    expect(buildFileKey("VIDEO", ".mp4")).toMatch(/^videos\/[0-9a-f-]{36}\.mp4$/);
  });

  test("generates a unique key on every call", () => {
    expect(buildFileKey("PDF", ".pdf")).not.toBe(buildFileKey("PDF", ".pdf"));
  });
});

describe("resolveStoragePath", () => {
  test("resolves a normal key inside the storage root", () => {
    expect(resolveStoragePath("pdf/abc.pdf")).toBe(path.join(testRoot, "pdf", "abc.pdf"));
  });

  test("rejects a path-traversal key", () => {
    expect(() => resolveStoragePath("../../etc/passwd")).toThrow();
  });

  test("rejects an absolute-path key that would escape the root", () => {
    expect(() => resolveStoragePath("/etc/passwd")).toThrow();
  });
});

describe("writeLocalFile / deleteLocalFile (real filesystem)", () => {
  test("creates category folders automatically and writes the file", async () => {
    const key = buildFileKey("PDF", ".pdf");

    const result = await writeLocalFile(key, Buffer.from("%PDF-1.4 test content"));

    expect(result).toEqual({ success: true });
    const written = await readFile(resolveStoragePath(key));
    expect(written.toString()).toBe("%PDF-1.4 test content");
  });

  test("does not silently overwrite an existing file at the same key", async () => {
    const key = `pdf/${randomUUID()}.pdf`;
    await writeLocalFile(key, Buffer.from("first"));

    const second = await writeLocalFile(key, Buffer.from("second"));

    expect(second.success).toBe(false);
    expect((await readFile(resolveStoragePath(key))).toString()).toBe("first");
  });

  test("returns a failure result instead of throwing when the write fails", async () => {
    // "blocked-parent" exists as a FILE, so mkdir can't turn it into a directory
    // for "blocked-parent/child.pdf" — a real, deterministic filesystem failure.
    await writeLocalFile("blocked-parent", Buffer.from("i am actually a file"));

    const result = await writeLocalFile("blocked-parent/child.pdf", Buffer.from("nope"));

    expect(result.success).toBe(false);
  });

  test("deletes a written file", async () => {
    const key = buildFileKey("IMAGE", ".png");
    await writeLocalFile(key, Buffer.from("fake png bytes"));

    await deleteLocalFile(key);

    await expect(stat(resolveStoragePath(key))).rejects.toThrow();
  });

  test("does not throw when deleting a file that does not exist", async () => {
    await expect(deleteLocalFile(`pdf/${randomUUID()}.pdf`)).resolves.toBeUndefined();
  });
});

// Sanity check that the temp root itself behaves like a normal directory.
describe("test setup", () => {
  test("uses an isolated temp directory as the storage root", async () => {
    await mkdir(testRoot, { recursive: true });
    const info = await stat(testRoot);
    expect(info.isDirectory()).toBe(true);
  });
});
