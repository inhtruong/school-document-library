import "server-only";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const FILE_CATEGORIES = ["PDF", "WORD", "EXCEL", "IMAGE", "VIDEO"] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

const CATEGORY_FOLDERS: Record<FileCategory, string> = {
  PDF: "pdf",
  WORD: "word",
  EXCEL: "excel",
  IMAGE: "images",
  VIDEO: "videos",
};

type FormatRule = { category: FileCategory; mimeTypes: readonly string[] };

/** Centralized allowlist — the only place that decides which formats are accepted. */
const FORMAT_ALLOWLIST: Record<string, FormatRule> = {
  ".pdf": { category: "PDF", mimeTypes: ["application/pdf"] },
  ".doc": { category: "WORD", mimeTypes: ["application/msword"] },
  ".docx": {
    category: "WORD",
    mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  },
  ".xls": { category: "EXCEL", mimeTypes: ["application/vnd.ms-excel"] },
  ".xlsx": {
    category: "EXCEL",
    mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  },
  ".jpg": { category: "IMAGE", mimeTypes: ["image/jpeg"] },
  ".jpeg": { category: "IMAGE", mimeTypes: ["image/jpeg"] },
  ".png": { category: "IMAGE", mimeTypes: ["image/png"] },
  ".webp": { category: "IMAGE", mimeTypes: ["image/webp"] },
  ".mp4": { category: "VIDEO", mimeTypes: ["video/mp4"] },
  ".webm": { category: "VIDEO", mimeTypes: ["video/webm"] },
};

/**
 * `.doc` and `.docx` share the WORD `fileCategory`, so telling modern DOCX
 * apart from legacy DOC (for preview support) has to go by `mimeType`, not
 * category alone. Derived from the allowlist above — the one place that
 * decides accepted formats — instead of a second hardcoded literal.
 */
export const DOCX_MIME_TYPE = FORMAT_ALLOWLIST[".docx"].mimeTypes[0];

type SignatureCheck = { offset: number; bytes: number[] };

/** Practical magic-byte checks — first bytes only, not a full file parser. */
const SIGNATURES: Partial<Record<string, SignatureCheck[]>> = {
  ".pdf": [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }], // %PDF-
  ".png": [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  ".jpg": [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  ".jpeg": [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  ".webp": [
    { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF"
    { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // "WEBP"
  ],
  // .docx/.xlsx are zip (OOXML) containers; .doc/.xls are OLE compound files.
  ".docx": [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  ".xlsx": [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  ".doc": [{ offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  ".xls": [{ offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  ".mp4": [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }], // "ftyp"
  ".webm": [{ offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }],
};

export type FormatCheckResult =
  | { valid: true; category: FileCategory; extension: string }
  | { valid: false; error: string };

/** Checks the extension against the allowlist, then that its declared MIME type matches. */
export function resolveFileFormat(fileName: string, mimeType: string): FormatCheckResult {
  const extension = path.extname(fileName).toLowerCase();
  const rule = FORMAT_ALLOWLIST[extension];

  if (!rule) {
    return { valid: false, error: "Unsupported file type" };
  }
  if (!rule.mimeTypes.includes(mimeType)) {
    return { valid: false, error: "File extension does not match its content type" };
  }
  return { valid: true, category: rule.category, extension };
}

/** Confirms the file's bytes match the signature expected for its extension, when one is defined. */
export function matchesFileSignature(buffer: Buffer, extension: string): boolean {
  const checks = SIGNATURES[extension];
  if (!checks) return true; // no practical signature for this format — skip.
  return checks.every((check) =>
    buffer.subarray(check.offset, check.offset + check.bytes.length).equals(Buffer.from(check.bytes))
  );
}

/** Server-generated, unpredictable relative path — never derived from the original filename. */
export function buildFileKey(category: FileCategory, extension: string): string {
  return path.posix.join(CATEGORY_FOLDERS[category], `${randomUUID()}${extension}`);
}

function getStorageRoot(): string {
  // Override hook for tests only; real usage always uses the project-root default.
  return process.env.STORAGE_LOCAL_ROOT
    ? path.resolve(process.env.STORAGE_LOCAL_ROOT)
    : path.resolve(process.cwd(), "storage_local");
}

/** Resolves a fileKey to an absolute path, rejecting anything that would escape the storage root. */
export function resolveStoragePath(fileKey: string): string {
  const root = getStorageRoot();
  const resolved = path.resolve(root, fileKey);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("Resolved storage path escapes the storage root");
  }
  return resolved;
}

export type LocalWriteResult = { success: true } | { success: false; error: string };

/** Creates category folders as needed and writes the file — fails rather than silently overwriting. */
export async function writeLocalFile(fileKey: string, data: Buffer): Promise<LocalWriteResult> {
  try {
    const absolutePath = resolveStoragePath(fileKey);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, data, { flag: "wx" });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown storage error";
    return { success: false, error: message };
  }
}

/** Best-effort cleanup for an orphaned upload — logs but never throws. */
export async function deleteLocalFile(fileKey: string): Promise<void> {
  try {
    await unlink(resolveStoragePath(fileKey));
  } catch (error) {
    const isMissing = (error as NodeJS.ErrnoException)?.code === "ENOENT";
    if (!isMissing) {
      console.error(`Failed to delete local file "${fileKey}":`, error);
    }
  }
}

export type LocalFileInfo =
  | { exists: true; absolutePath: string; size: number }
  | { exists: false };

/**
 * Confirms a stored file still exists on disk (DB and filesystem can drift)
 * and returns its size. Never throws — a bad/traversal-attempting key or a
 * missing file both resolve to `{ exists: false }` so callers can respond
 * with a generic "not available" instead of leaking filesystem details.
 */
export async function statLocalFile(fileKey: string): Promise<LocalFileInfo> {
  try {
    const absolutePath = resolveStoragePath(fileKey);
    const info = await stat(absolutePath);
    return { exists: true, absolutePath, size: info.size };
  } catch (error) {
    const isMissing = (error as NodeJS.ErrnoException)?.code === "ENOENT";
    if (!isMissing) {
      console.error(`Failed to stat local file "${fileKey}":`, error);
    }
    return { exists: false };
  }
}

/** Opens a read stream for an already-resolved, already-verified absolute path. */
export function createLocalFileReadStream(
  absolutePath: string,
  range?: { start: number; end: number }
) {
  return createReadStream(absolutePath, range ? { start: range.start, end: range.end } : undefined);
}
