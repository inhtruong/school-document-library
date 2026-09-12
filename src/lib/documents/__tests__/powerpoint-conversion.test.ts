import { stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const execFileMock = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

import { convertPowerPointToPdf, POWERPOINT_CONVERSION_TIMEOUT_MS } from "@/lib/documents/powerpoint-conversion";

const FAKE_PPTX = Buffer.from("fake pptx bytes for testing purposes only");

type ExecFileArgs = [string, string[], Record<string, unknown>, (error: unknown) => void];

function lastCallArgs(): ExecFileArgs {
  return execFileMock.mock.calls[execFileMock.mock.calls.length - 1] as ExecFileArgs;
}

function outdirFrom(args: ExecFileArgs): string {
  const [, argv] = args;
  const index = argv.indexOf("--outdir");
  return argv[index + 1];
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.LIBREOFFICE_PATH;
});

afterEach(() => {
  delete process.env.LIBREOFFICE_PATH;
});

describe("convertPowerPointToPdf — success", () => {
  test("returns the generated PDF bytes when LibreOffice succeeds", async () => {
    execFileMock.mockImplementation((_cmd, argv, _opts, callback) => {
      const outdir = outdirFrom([_cmd, argv, _opts, callback]);
      writeFile(path.join(outdir, "source.pdf"), "%PDF-1.4 fake generated pdf").then(() => callback(null));
    });

    const result = await convertPowerPointToPdf(FAKE_PPTX, ".pptx");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.pdf.toString()).toBe("%PDF-1.4 fake generated pdf");
  });

  test("supports .ppt the same way as .pptx", async () => {
    execFileMock.mockImplementation((_cmd, argv, _opts, callback) => {
      const outdir = outdirFrom([_cmd, argv, _opts, callback]);
      writeFile(path.join(outdir, "source.pdf"), "%PDF-1.4 fake generated pdf").then(() => callback(null));
    });

    const result = await convertPowerPointToPdf(FAKE_PPTX, ".ppt");

    expect(result.success).toBe(true);
  });

  test("uses the configurable LIBREOFFICE_PATH when set, instead of the default soffice", async () => {
    process.env.LIBREOFFICE_PATH = "/opt/libreoffice/soffice";
    execFileMock.mockImplementation((_cmd, argv, _opts, callback) => {
      const outdir = outdirFrom([_cmd, argv, _opts, callback]);
      writeFile(path.join(outdir, "source.pdf"), "%PDF-1.4").then(() => callback(null));
    });

    await convertPowerPointToPdf(FAKE_PPTX, ".pptx");

    expect(execFileMock).toHaveBeenCalledWith(
      "/opt/libreoffice/soffice",
      expect.any(Array),
      expect.any(Object),
      expect.any(Function)
    );
  });
});

describe("convertPowerPointToPdf — safe path handling", () => {
  test("never passes a user-controlled filename — the input is always the fixed literal source.pptx", async () => {
    execFileMock.mockImplementation((_cmd, argv, _opts, callback) => {
      const outdir = outdirFrom([_cmd, argv, _opts, callback]);
      writeFile(path.join(outdir, "source.pdf"), "%PDF-1.4").then(() => callback(null));
    });

    await convertPowerPointToPdf(FAKE_PPTX, ".pptx");

    const [, argv] = lastCallArgs();
    const inputPath = argv[argv.length - 1];
    expect(path.basename(inputPath)).toBe("source.pptx");
  });

  test("uses a fresh, isolated temp directory under the OS tmpdir for every call", async () => {
    const seenDirs: string[] = [];
    execFileMock.mockImplementation((_cmd, argv, _opts, callback) => {
      const outdir = outdirFrom([_cmd, argv, _opts, callback]);
      seenDirs.push(outdir);
      writeFile(path.join(outdir, "source.pdf"), "%PDF-1.4").then(() => callback(null));
    });

    await convertPowerPointToPdf(FAKE_PPTX, ".pptx");
    await convertPowerPointToPdf(FAKE_PPTX, ".pptx");

    expect(seenDirs[0]).not.toBe(seenDirs[1]);
    expect(path.basename(seenDirs[0])).toMatch(/^ppt-convert-/);
  });

  test("sets an isolated LibreOffice user profile inside the same temp dir (avoids concurrent-instance profile lock contention)", async () => {
    execFileMock.mockImplementation((_cmd, argv, _opts, callback) => {
      const outdir = outdirFrom([_cmd, argv, _opts, callback]);
      writeFile(path.join(outdir, "source.pdf"), "%PDF-1.4").then(() => callback(null));
    });

    await convertPowerPointToPdf(FAKE_PPTX, ".pptx");

    const [, argv] = lastCallArgs();
    const profileArg = argv.find((arg) => arg.startsWith("-env:UserInstallation="));
    expect(profileArg).toBeDefined();
  });

  test("cleans up the temp directory after a successful conversion", async () => {
    let capturedDir = "";
    execFileMock.mockImplementation((_cmd, argv, _opts, callback) => {
      capturedDir = outdirFrom([_cmd, argv, _opts, callback]);
      writeFile(path.join(capturedDir, "source.pdf"), "%PDF-1.4").then(() => callback(null));
    });

    await convertPowerPointToPdf(FAKE_PPTX, ".pptx");

    await expect(stat(capturedDir)).rejects.toThrow();
  });
});

describe("convertPowerPointToPdf — failure handling", () => {
  test("reports a clear error when LibreOffice is not installed (ENOENT)", async () => {
    execFileMock.mockImplementation((_cmd, _argv, _opts, callback) => {
      const error = Object.assign(new Error("spawn soffice ENOENT"), { code: "ENOENT" });
      callback(error);
    });

    const result = await convertPowerPointToPdf(FAKE_PPTX, ".pptx");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/not installed|not found/i);
  });

  test("reports a clear timeout error when the process is killed for exceeding the timeout", async () => {
    execFileMock.mockImplementation((_cmd, _argv, _opts, callback) => {
      const error = Object.assign(new Error("Command timed out"), { killed: true, signal: "SIGTERM" });
      callback(error);
    });

    const result = await convertPowerPointToPdf(FAKE_PPTX, ".pptx");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/timed out/i);
  });

  test("passes the configured timeout through to execFile", async () => {
    execFileMock.mockImplementation((_cmd, argv, _opts, callback) => {
      const outdir = outdirFrom([_cmd, argv, _opts, callback]);
      writeFile(path.join(outdir, "source.pdf"), "%PDF-1.4").then(() => callback(null));
    });

    await convertPowerPointToPdf(FAKE_PPTX, ".pptx");

    const [, , opts] = lastCallArgs();
    expect(opts.timeout).toBe(POWERPOINT_CONVERSION_TIMEOUT_MS);
  });

  test("fails when LibreOffice exits 'successfully' but never actually produced source.pdf", async () => {
    execFileMock.mockImplementation((_cmd, _argv, _opts, callback) => callback(null));

    const result = await convertPowerPointToPdf(FAKE_PPTX, ".pptx");

    expect(result.success).toBe(false);
  });

  test("does not silently mark a conversion successful when the produced file is empty", async () => {
    execFileMock.mockImplementation((_cmd, argv, _opts, callback) => {
      const outdir = outdirFrom([_cmd, argv, _opts, callback]);
      writeFile(path.join(outdir, "source.pdf"), Buffer.alloc(0)).then(() => callback(null));
    });

    const result = await convertPowerPointToPdf(FAKE_PPTX, ".pptx");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/empty/i);
  });

  test("cleans up the temp directory even when conversion fails", async () => {
    let capturedDir = "";
    execFileMock.mockImplementation((_cmd, argv, _opts, callback) => {
      capturedDir = outdirFrom([_cmd, argv, _opts, callback]);
      callback(new Error("LibreOffice crashed"));
    });

    await convertPowerPointToPdf(FAKE_PPTX, ".pptx");

    await expect(stat(capturedDir)).rejects.toThrow();
  });

  test("reports a generic message for an unrecognized error shape rather than throwing", async () => {
    execFileMock.mockImplementation((_cmd, _argv, _opts, callback) => callback(new Error("something odd happened")));

    const result = await convertPowerPointToPdf(FAKE_PPTX, ".pptx");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("something odd happened");
  });
});
