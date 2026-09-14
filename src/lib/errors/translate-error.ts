import "server-only";
import { getTranslations } from "next-intl/server";
import { errorMessageKey, isErrorCode, type ErrorCode } from "@/lib/errors/error-codes";

/**
 * The handful of codes whose message carries exactly one interpolated
 * value — encoded onto the wire as `CODE|value` (see `encodeErrorCode`)
 * since a bare error string is the only channel available across the
 * safeParse → business-logic → API/Server-Action boundary.
 */
const ERROR_CODE_PARAM_NAMES: Partial<Record<ErrorCode, string>> = {
  VALIDATION_COMMENT_TOO_LONG: "max",
  VALIDATION_DESCRIPTION_TOO_LONG: "max",
  UPLOAD_FILE_TOO_LARGE: "size",
  UPLOAD_POWERPOINT_CONVERSION_FAILED: "reason",
};

/** Encodes a code (and optional single param) into the plain string carried through Zod/business-logic `error` fields. */
export function encodeErrorCode(code: ErrorCode, ...params: (string | number)[]): string {
  return params.length ? `${code}|${params.join("|")}` : code;
}

/**
 * Resolves a raw error code (optionally `CODE|param`) into localized text
 * for the active request locale. This is the ONLY place a business-logic
 * error code becomes user-facing prose — call it at the presentation/
 * request boundary (API route, Server Action), never deep in business logic.
 */
export async function translateErrorCode(raw: string): Promise<string> {
  const [codeCandidate, ...params] = raw.split("|");

  if (isErrorCode(codeCandidate)) {
    const t = await getTranslations("errors.codes");
    const paramName = ERROR_CODE_PARAM_NAMES[codeCandidate];
    const values = paramName && params.length > 0 ? { [paramName]: params[0] } : undefined;
    return t(errorMessageKey(codeCandidate), values);
  }

  // Defensive fallback — should never happen once every error source
  // returns a known code, but must never crash or leak a raw code/string
  // to the user.
  console.error("translateErrorCode: unknown code", raw);
  const t = await getTranslations("errors.codes");
  return t(errorMessageKey("UNEXPECTED_ERROR"));
}
