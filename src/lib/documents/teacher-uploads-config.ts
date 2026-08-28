/**
 * Centralized "my uploads" list page size — a Teacher's personal document
 * list, not an Admin review queue, so it matches SAVED_PAGE_SIZE /
 * FOLLOWING_PAGE_SIZE / SEARCH_PAGE_SIZE (12) rather than the higher-volume
 * MODERATION_PAGE_SIZE (20). Change here, not scattered across routes.
 */
export const TEACHER_UPLOADS_PAGE_SIZE = 12;
