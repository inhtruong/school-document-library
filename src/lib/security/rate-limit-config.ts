/**
 * Centralized rate-limit thresholds — change here, not scattered across
 * routes. Deliberately conservative: the goal is stopping obvious abuse
 * (credential stuffing, spam, storage abuse), not frustrating normal users.
 * Public GET endpoints (search, detail, preview) are intentionally NOT
 * rate-limited here — only mutation/auth endpoints are.
 */

export const LOGIN_RATE_LIMIT = { limit: 10, windowMs: 5 * 60 * 1000 }; // 10 attempts / 5 min / IP
export const REGISTER_RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 }; // 5 / hour / IP
export const UPLOAD_RATE_LIMIT = { limit: 20, windowMs: 60 * 60 * 1000 }; // 20 / hour / user
export const COMMENT_RATE_LIMIT = { limit: 20, windowMs: 10 * 60 * 1000 }; // 20 / 10 min / user
export const REPORT_RATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 }; // 10 / hour / user
export const RATING_RATE_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 }; // 30 / 10 min / user
export const PASSWORD_CHANGE_RATE_LIMIT = { limit: 8, windowMs: 15 * 60 * 1000 }; // 8 / 15 min / user
