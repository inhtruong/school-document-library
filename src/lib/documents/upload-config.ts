/**
 * Single source of truth for the upload size limit — imported by validation,
 * the upload UI, and tests. Change it here only.
 */
export const MAX_UPLOAD_SIZE_MB = 10;
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
