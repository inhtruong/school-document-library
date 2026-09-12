import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** 30s is generous for a single slide deck while still bounding worst-case resource usage per upload. */
export const POWERPOINT_CONVERSION_TIMEOUT_MS = 30_000;

/**
 * Resolves the LibreOffice executable. Configurable via `LIBREOFFICE_PATH`
 * (an absolute path or a bare command resolved via PATH) for environments
 * where `soffice` isn't on PATH or a specific binary must be pinned —
 * deliberately NOT validated at app startup (unlike STORAGE_ROOT): FEAT-12A
 * §"Production readiness" requires failing clearly per-conversion-attempt,
 * not blocking the whole app from starting when LibreOffice is absent (it
 * may not exist on the VPS yet).
 */
function getLibreOfficeExecutable(): string {
  return process.env.LIBREOFFICE_PATH?.trim() || "soffice";
}

export type PowerPointConversionResult = { success: true; pdf: Buffer } | { success: false; error: string };

function describeConversionError(error: unknown): string {
  if (error && typeof error === "object") {
    const err = error as NodeJS.ErrnoException & { killed?: boolean; signal?: string | null };
    if (err.code === "ENOENT") {
      return "LibreOffice is not installed or not found on this server";
    }
    if (err.killed || err.signal === "SIGTERM") {
      return "PowerPoint conversion timed out";
    }
  }
  return error instanceof Error ? error.message : "PowerPoint conversion failed";
}

/**
 * Converts a PowerPoint file (buffer) to PDF via LibreOffice headless,
 * entirely inside a fresh, isolated temporary directory — the ORIGINAL
 * file (already saved to permanent storage by the caller) is never read
 * from or written to here.
 *
 * Safety properties, all satisfied by construction rather than by
 * defensive checks on untrusted input:
 * - `execFile` (never `exec`/`shell: true`) with a fixed argv array — the
 *   input is passed as a real argv element, never interpolated into a
 *   shell command string, so there is no shell-injection surface.
 * - The input filename inside the temp dir is always the fixed literal
 *   `source.pptx`/`source.ppt` — never derived from the caller's original
 *   filename — so there is no path-traversal surface; LibreOffice never
 *   sees a user-controlled path.
 * - `mkdtemp` guarantees a fresh, unique directory per call, so concurrent
 *   conversions can never collide or overwrite each other's files.
 * - `-env:UserInstallation` points LibreOffice's own profile/lock state at
 *   a subdirectory of that same temp dir, so concurrent `soffice` headless
 *   invocations (a well-known real-world failure mode) never contend over
 *   a shared user profile lock.
 * - A hard `timeout` bounds worst-case resource usage per attempt.
 * - The output is read back from the one deterministic path LibreOffice's
 *   own naming convention guarantees (`<outdir>/source.pdf`) — never
 *   parsed from subprocess stdout — so a missing/empty result is detected
 *   directly (`readFile` throws ENOENT; an empty buffer is rejected) rather
 *   than trusted on the strength of a zero exit code alone.
 * - The temp directory (input, LibreOffice profile, and output alike) is
 *   always removed in `finally`, on every success/failure/timeout path.
 */
export async function convertPowerPointToPdf(
  input: Buffer,
  extension: ".ppt" | ".pptx"
): Promise<PowerPointConversionResult> {
  let tempDir: string | null = null;
  try {
    tempDir = await mkdtemp(path.join(tmpdir(), "ppt-convert-"));
    const inputPath = path.join(tempDir, `source${extension}`);
    const profileDir = path.join(tempDir, "loprofile");
    await writeFile(inputPath, input);

    await new Promise<void>((resolve, reject) => {
      execFile(
        getLibreOfficeExecutable(),
        [
          "--headless",
          "--norestore",
          `-env:UserInstallation=file://${profileDir}`,
          "--convert-to",
          "pdf",
          "--outdir",
          tempDir!,
          inputPath,
        ],
        { timeout: POWERPOINT_CONVERSION_TIMEOUT_MS },
        (error) => (error ? reject(error) : resolve())
      );
    });

    const outputPath = path.join(tempDir, "source.pdf");
    const pdf = await readFile(outputPath);
    if (pdf.length === 0) {
      return { success: false, error: "PowerPoint conversion produced an empty file" };
    }
    return { success: true, pdf };
  } catch (error) {
    return { success: false, error: describeConversionError(error) };
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
