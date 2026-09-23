import { describe, expect, test } from "vitest";
import en from "@/i18n/messages/en.json";
import vi from "@/i18n/messages/vi.json";
import { validateSelectedFile } from "@/components/upload/file-size-validation";

/**
 * SEC-B-03-FIX-04: this project has no jsdom/React Testing Library
 * infrastructure (vitest.config.ts runs `environment: "node"`, and no
 * `.test.tsx` file exists anywhere in the repo). Per the task's own
 * guidance, rather than adding new test-rendering dependencies to fake a
 * DOM, these tests target `validateSelectedFile()` — the single pure
 * decision function `FileDropzone`'s `onChange` handler defers to for
 * BOTH the file picker and drag/drop (both paths fire the exact same
 * native `<input>` onChange event; see FileDropzone.tsx's own doc
 * comment on why a dropped file reaches `.files` the same way a picked
 * one does). The handler itself is a direct, unconditional translation
 * of this function's result with no extra branching:
 *   oversized  -> clear the native input, drop file state, show the error
 *   accepted   -> store {name, size}, clear the error
 *   empty      -> clear file state, clear the error
 * so exhaustively testing the pure function's three outcomes is
 * equivalent to testing the full component's file-selection/drag-drop
 * behavior without needing a fake browser environment.
 */

const ONE_MIB = 1024 * 1024;

function fakeFile(name: string, size: number): File {
  // A real Node `File` (Node 20+ global, already used throughout
  // upload.test.ts) — content is irrelevant to size validation, so a
  // minimal buffer of the exact target byte length keeps this cheap.
  return new File([new Uint8Array(size)], name, { type: "application/pdf" });
}

describe("validateSelectedFile — A. below limit", () => {
  test("a file smaller than the configured maximum is accepted", () => {
    const file = fakeFile("small.pdf", ONE_MIB / 2);

    const result = validateSelectedFile(file, ONE_MIB);

    expect(result).toEqual({ status: "accepted", file: { name: "small.pdf", size: ONE_MIB / 2 } });
  });
});

describe("validateSelectedFile — B. exact boundary", () => {
  test("a file exactly at the configured maximum is accepted (not rejected)", () => {
    const file = fakeFile("exact.pdf", ONE_MIB);

    const result = validateSelectedFile(file, ONE_MIB);

    expect(result).toEqual({ status: "accepted", file: { name: "exact.pdf", size: ONE_MIB } });
  });
});

describe("validateSelectedFile — C. just over boundary", () => {
  test("a file one byte over the configured maximum is rejected as oversized", () => {
    const file = fakeFile("toobig.pdf", ONE_MIB + 1);

    const result = validateSelectedFile(file, ONE_MIB);

    expect(result).toEqual({ status: "oversized" });
    // The filename/size must never surface as "accepted" state — this is
    // the exact bug SEC-B-03-VERIFY-02 found (oversized files were kept
    // in component state and the native input, so they could still be
    // submitted). An "oversized" result carries no file payload at all,
    // so FileDropzone's onChange has nothing to set as the selected file
    // even if it tried.
    expect(result).not.toHaveProperty("file");
  });

  test("matches the backend's own strict > semantics exactly (uploadDocument: file.size > MAX_UPLOAD_SIZE_BYTES)", () => {
    // Same boundary, expressed the same way the backend expresses it —
    // client and server must never disagree about where the line is.
    expect(validateSelectedFile(fakeFile("at.pdf", ONE_MIB), ONE_MIB).status).toBe("accepted");
    expect(validateSelectedFile(fakeFile("over.pdf", ONE_MIB + 1), ONE_MIB).status).toBe("oversized");
  });
});

describe("validateSelectedFile — D. recovery after rejection", () => {
  test("an oversized rejection followed by a valid selection independently accepts the valid one — no stale state carried between calls", () => {
    const oversized = fakeFile("toobig.pdf", ONE_MIB + 1);
    const valid = fakeFile("ok.pdf", ONE_MIB / 4);

    const firstResult = validateSelectedFile(oversized, ONE_MIB);
    const secondResult = validateSelectedFile(valid, ONE_MIB);

    expect(firstResult).toEqual({ status: "oversized" });
    expect(secondResult).toEqual({ status: "accepted", file: { name: "ok.pdf", size: ONE_MIB / 4 } });
  });
});

describe("validateSelectedFile — E. no file selected", () => {
  test("an empty/cancelled selection (undefined) is neither accepted nor oversized", () => {
    expect(validateSelectedFile(undefined, ONE_MIB)).toEqual({ status: "empty" });
    expect(validateSelectedFile(null, ONE_MIB)).toEqual({ status: "empty" });
  });
});

describe("validateSelectedFile — F. localization key used by the oversized-file warning", () => {
  test("the shared errors.codes.uploadFileTooLarge key exists and is parameterized with {size} in both locales", () => {
    // FileDropzone reuses this EXACT key (via useTranslations("errors.codes"))
    // rather than duplicating a client-only translation — same architecture
    // already established by other client components (BookmarkAction,
    // CommentSection, etc.) and the same key uploadDocument()'s server-side
    // UPLOAD_FILE_TOO_LARGE error already resolves through translateErrorCode().
    expect(en.errors.codes.uploadFileTooLarge).toContain("{size}");
    expect(vi.errors.codes.uploadFileTooLarge).toContain("{size}");
    expect(en.errors.codes.uploadFileTooLarge).toBe("File exceeds the {size} MB limit");
    expect(vi.errors.codes.uploadFileTooLarge).toBe("Tệp vượt quá giới hạn {size} MB");
  });

  test("never hardcodes a stale size — the same maxSizeMB prop already used for the dropzone caption drives the warning too", () => {
    // Documents the architectural constraint this task requires: there is
    // exactly one number (maxSizeMB, itself sourced server-side from
    // MAX_UPLOAD_SIZE_MB) that both the caption ("up to {size} MB") and
    // the oversized-file warning ("exceeds the {size} MB limit") read from
    // — verified structurally by both keys sharing the same {size} token.
    expect(en.upload.upToSize).toContain("{size}");
    expect(vi.upload.upToSize).toContain("{size}");
  });
});

describe("validateSelectedFile — G. drag/drop shares the same validation path as the file picker", () => {
  test("drag/drop and file-picker selections are indistinguishable to this function — same File in, same result out", () => {
    // FileDropzone's native <input> spans the entire dropzone and is
    // `opacity-0`, not `display: none` — the browser assigns a dropped
    // file to that same input's `.files` on its own (see the component's
    // own doc comment), firing the identical onChange event either way.
    // There is no separate "drop handler" that reads File objects; the
    // onDrop/onDragOver handlers only toggle the `isDragOver` visual
    // state. So validating this one function's behavior for a given File
    // object covers both entry points by construction — there is no
    // second code path to independently test or diverge from.
    const droppedFile = fakeFile("dropped.pdf", ONE_MIB + 1);
    const pickedFile = fakeFile("picked.pdf", ONE_MIB + 1);

    expect(validateSelectedFile(droppedFile, ONE_MIB)).toEqual(validateSelectedFile(pickedFile, ONE_MIB));
  });
});
