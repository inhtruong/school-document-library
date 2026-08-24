# Stacks — school document library (step 1)

Homepage → search → search results → document detail, backed by a real
PostgreSQL database through a Prisma-powered REST API. Authentication
(email/password via Auth.js) with STUDENT/TEACHER/ADMIN roles is implemented.
Teachers and admins classify uploads with a structured education taxonomy —
Grade → Subject → Lesson/Topic, plus a controlled Document Type — and upload
documents (PDF, Word, Excel, images, video) to local file storage. `/search`
supports filtering by that same taxonomy (cascading Grade → Subject → Lesson,
plus Document Type), sorting, and pagination, all reflected in the URL — see
[Search](#search). Anyone — including guests — can preview PDF, image, video,
and modern Word (`.docx`) files directly from the document detail page;
legacy `.doc` and Excel show an "unsupported yet" placeholder. Downloading
the original file requires being signed in (any role); guests are sent to
log in and returned to the same document. No AI yet.

## Stack

- Next.js (App Router) + React + Tailwind CSS + shadcn-style UI primitives
- Next.js Route Handlers for the API
- PostgreSQL + Prisma ORM
- Auth.js (Credentials provider, JWT sessions)
- Local filesystem storage (`storage_local/`) for uploaded files — no external
  storage service required

## Run it

1. Start a local Postgres (either works):

   ```bash
   docker compose up -d
   ```

   or point `DATABASE_URL` in `.env` at any Postgres instance you already have running.

2. Create your `.env` from the example, then set an `AUTH_SECRET`:

   ```bash
   cp .env.example .env
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Paste the generated value into `AUTH_SECRET` in `.env`.

   No other setup is needed for uploads — files are stored on the local
   filesystem under `storage_local/`, created automatically on first upload.
   See [Uploads](#uploads) below.

3. Install dependencies, run the migration, and seed sample data:

   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   ```

   Seeding creates the sample documents plus three development accounts —
   see [Auth](#auth) below.

4. Start the app:

   ```bash
   npm run dev
   ```

   Then open http://localhost:3000

## Scripts

```
npm run dev                start the Next.js dev server
npm run build              production build
npm start                  run a production build (npm run build first) — binds 127.0.0.1:3000 only, see Production below
npm run db:generate        regenerate the Prisma client
npm run db:migrate         create/apply a migration (dev)
npm run db:migrate:deploy  apply pending migrations without prompting (production — see Production below)
npm run db:seed            reset and reseed sample documents (refuses to run when NODE_ENV=production)
npm run create-admin       interactively create the first production ADMIN account (see Production below)
npm run db:studio          open Prisma Studio to browse the database
npm test                   run the Vitest suite
```

## What's here

```
storage_local/                    uploaded files, auto-created (gitignored) — see Uploads below
prisma/
  schema.prisma                   Document, User, Grade, Subject, Lesson, DocumentRating, DocumentComment, DocumentReport, DocumentBookmark, TeacherFollow, LessonFollow, Notification models + Role/FileCategory/DocumentType/ReportReason/ReportStatus/NotificationType enums
  seed.ts                         taxonomy (grades/subjects/lessons) + sample documents + dev accounts — refuses to run when NODE_ENV=production (see Production below)
  create-admin.ts                 npm run create-admin — interactive CLI to create the first production ADMIN account (see Production below)
src/
  auth.ts                         Auth.js config: Credentials provider, JWT callbacks
  app/
    layout.tsx                    fonts, header, footer
    page.tsx                      homepage: hero search, subjects, popular documents
    search/page.tsx               results page — filters/sort/pagination, URL is the source of truth (see Search below)
    documents/[id]/               document detail page (renders FilePreview) + not-found state
    saved/page.tsx                 requires auth; paginated list of the current user's bookmarked documents (see Bookmarks below)
    following/page.tsx             requires auth; paginated Followed Teachers + Followed Lessons, independent ?teachersPage=/?lessonsPage= (see Follow below)
    notifications/page.tsx         requires auth; paginated notification list, newest first, "Mark all as read" (see Notifications below)
    login/page.tsx                email/password login (server action)
    register/page.tsx             registration — always creates STUDENT
    profile/page.tsx              requires auth; shows name/email/role
    upload/page.tsx               TEACHER/ADMIN only; file upload form (server action)
    error.tsx                     friendly fallback if the API/DB is unreachable
    api/
      documents/route.ts                GET (search + filters + sort + pagination, see Search below), POST
      documents/[id]/route.ts           GET, PUT, DELETE
      documents/upload/route.ts         POST — TEACHER/ADMIN only, multipart file upload
      documents/[id]/preview/route.ts   GET — public, streams the file inline (see Preview below)
      documents/[id]/download/route.ts  GET — any signed-in user, attachment download (see Download below)
      documents/[id]/ratings/route.ts   GET — public, average/count/current-user summary (see Rating below)
      documents/[id]/rating/route.ts    PUT — any signed-in user, create-or-update one's own rating (see Rating below)
      documents/[id]/comments/route.ts             GET — public list, POST — any signed-in user (see Comments below)
      documents/[id]/comments/[commentId]/route.ts PUT/DELETE — owner only to edit, owner or ADMIN to delete (see Comments below)
      documents/[id]/reports/route.ts               POST — any signed-in user, create a report (see Reporting below)
      documents/[id]/reports/mine/route.ts          GET — any signed-in user, own OPEN report reasons only (see Reporting below)
      documents/[id]/bookmark/route.ts               GET/POST/DELETE — any signed-in user, own saved state only (see Bookmarks below)
      teachers/[teacherId]/follow/route.ts          GET/POST/DELETE — any signed-in user, own follow state only; target must be role=TEACHER (see Follow below)
      lessons/[lessonId]/follow/route.ts            GET/POST/DELETE — any signed-in user, own follow state only (see Follow below)
      notifications/route.ts                        GET — any signed-in user, own notifications only, paginated (see Notifications below)
      notifications/unread-count/route.ts           GET — any signed-in user, own unread count only (see Notifications below)
      notifications/[id]/read/route.ts              PATCH — any signed-in user, own notification only (see Notifications below)
      notifications/read-all/route.ts               POST — any signed-in user, marks own unread notifications read (see Notifications below)
      subjects/route.ts                 GET — no ?gradeId=: legacy subject grouping (homepage); with ?gradeId=: taxonomy Subjects for that Grade
      grades/route.ts                   GET — all Grades ordered by sortOrder (see Education Taxonomy below)
      lessons/route.ts                  GET ?subjectId=... — Lessons/Topics for one Subject
      auth/[...nextauth]/route.ts       Auth.js handlers (session, sign-in/out)
      auth/register/route.ts            POST — always creates STUDENT
      health/route.ts                   GET — public, { status, checks: { database } } for VPS monitoring/deploy verification (see Production below)
  components/
    ui/                                 Button, Input, Badge, Card primitives
    SearchBar.tsx                       client component; pushes ?q=..., preserving any active filters/sort from the URL
    SearchFilters.tsx                   client component: Grade → Subject → Lesson/Topic + Document Type + Sort, URL-driven (see Search below)
    DocumentCard.tsx                    title, taxonomy/subject, type, academic year, description
    SubjectCard.tsx                     subject + live document count
    SiteHeader.tsx                      logo, nav, session-aware login/profile/logout/upload/saved/following/notifications bell + unread badge
    FilePreview.tsx                     PDF/image/video/docx preview, unsupported/unavailable placeholders
    DocxPreview.tsx                     client-only .docx renderer (docx-preview), loading/error states
    docx-preview-render.ts              fetch + render orchestration used by DocxPreview (unit-testable)
    DownloadButton.tsx                  login link for guests, protected download link once signed in
    download-href.ts                    pure href-decision logic behind DownloadButton (unit-testable)
    TaxonomySelectFields.tsx            client component: Grade → Subject → Lesson cascading selects on /upload
    StarRating.tsx                      reusable 5-star control — read-only display or interactive (button/radiogroup) (see Rating below)
    DocumentRatingSection.tsx           client component on /documents/[id]: average/count, guest login link, authenticated submit + revalidate (see Rating below)
    CommentSection.tsx                  client component on /documents/[id]: list/count/pagination, guest login prompt, post form (see Comments below)
    CommentForm.tsx                     plain textarea + submit, char count, disabled while empty/submitting (see Comments below)
    CommentItem.tsx                     one comment — inline Edit (textarea) and inline delete confirmation, owner/ADMIN-gated (see Comments below)
    ReportDocumentAction.tsx            small secondary link + inline expandable form; guest login link, reason select + optional/required description (see Reporting below)
    BookmarkAction.tsx                   heart-icon toggle (♡ Save document / ♥ Saved); guest login link (see Bookmarks below)
    TeacherFollowAction.tsx             follow/unfollow toggle shown next to the uploader on /documents/[id] when they're a TEACHER; hidden for self (see Follow below)
    LessonFollowAction.tsx              follow/unfollow toggle shown next to the Lesson on /documents/[id] when the Document has one (see Follow below)
    FollowedTeachersList.tsx            client list on /following — Unfollow removes the item from the current page immediately (see Follow below)
    FollowedLessonsList.tsx             client list on /following — same Unfollow pattern as FollowedTeachersList (see Follow below)
    NotificationsList.tsx               client list on /notifications — local read state, "Mark all as read" (see Notifications below)
    NotificationItem.tsx                one notification — click marks it read and navigates to the Document (see Notifications below)
  lib/
    prisma.ts                       Prisma client singleton
    env.ts                          "server-only"-guarded re-export of env-core.ts — real app code imports this (see Production below)
    env-core.ts                     unguarded env config logic: STORAGE_ROOT/MAX_UPLOAD_SIZE_MB/APP_URL readers + validateProductionEnv() — only next.config.ts/prisma/*.ts import this directly (see Production below)
    api-response.ts                 { success, data, error, meta } response envelope
    validation/document.ts          zod schemas for create/update
    validation/auth.ts              zod schemas for register/login
    validation/rating.ts            zod schema for a 1-5 star rating value
    validation/comment.ts           zod schema for comment content (trim, 1-COMMENT_MAX_LENGTH, plain text)
    validation/report.ts            zod schema for { reason, description? } — description required only when reason is OTHER
    auth/
      password.ts                   bcrypt hash/verify
      authenticate.ts               Credentials provider authorize() logic
      session.ts                    jwt/session callback logic
      register.ts                   registerStudent() — role always STUDENT
      create-admin.ts                createAdminUser() — role always ADMIN, used only by prisma/create-admin.ts (see Production below)
      authorize.ts                  requireAuth(), requireRole(), hasRole()
      callback-url.ts               isSafeCallbackUrl()/resolveCallbackUrl() — open-redirect guard for ?callbackUrl=
      document-login-href.ts        documentLoginHref() / loginHrefFor() — shared /login?callbackUrl= builder (Download, Rating, Comments, Reporting, Bookmarks/Saved, Follow/Following, Notifications)
    documents/
      upload.ts                     uploadDocument() — validate taxonomy + file, store, create Document
      upload-config.ts              MAX_UPLOAD_SIZE_MB / MAX_UPLOAD_SIZE_BYTES (central config)
      taxonomy.ts                   validateTaxonomySelection() — server-side Grade/Subject/Lesson hierarchy check (upload path, all 3 required)
      search-query.ts               parseSearchQuery() + SEARCH_PAGE_SIZE/SORT_VALUES/SORT_ORDER_BY — pure search query parsing (see Search below)
      search-filters.ts             resolveSearchTaxonomyFilters() — tolerant Grade/Subject/Lesson resolution for search (drops invalid/mismatched IDs instead of rejecting)
      document-type.ts              DOCUMENT_TYPE_VALUES / DOCUMENT_TYPE_LABELS — controlled Document Type
      subject-accent.ts             cosmetic accent-colour helper (no document data)
      preview-range.ts              pure `Range: bytes=` header parser for video seeking
      preview-kind.ts               resolvePreviewKind() — single source of truth for what's previewable
      content-disposition.ts        buildContentDisposition() — safe attachment filename header
      rating.ts                     getRatingSummary() — average/count via Prisma aggregate() + the caller's own rating (see Rating below)
      comment.ts                    listComments()/createComment()/toCommentPayload() — newest-first, paginated, author select limited to id/name/role (see Comments below)
      comment-config.ts             COMMENT_MAX_LENGTH / COMMENTS_PAGE_SIZE (central config)
      report.ts                     createReport()/getMyOpenReportReasons() — duplicate-OPEN-report check + creation (see Reporting below)
      report-reason.ts              REPORT_REASON_VALUES / REPORT_REASON_LABELS — controlled Report Reason
      report-config.ts              REPORT_DESCRIPTION_MAX_LENGTH (central config)
      bookmark.ts                    isBookmarked()/addBookmark()/removeBookmark()/listUserBookmarks() — private per user, no global counts (see Bookmarks below)
      bookmark-config.ts             SAVED_PAGE_SIZE (central config)
    storage/
      local-storage.ts              format/category rules, safe keys, fs read/write/delete, plus statLocalFile/createLocalFileReadStream reused by both preview and download
    follow/
      teacher-follow.ts             isFollowingTeacher()/followTeacher()/unfollowTeacher()/listFollowedTeachers() — TEACHER-only target, self-follow rejected (see Follow below)
      lesson-follow.ts              isFollowingLesson()/followLesson()/unfollowLesson()/listFollowedLessons() (see Follow below)
      follow-config.ts              FOLLOWING_PAGE_SIZE (central config, shared by Teachers/Lessons lists)
    notifications/
      notification.ts               createNewDocumentNotifications()/listNotifications()/getUnreadNotificationCount()/markNotificationRead()/markAllNotificationsRead() (see Notifications below)
      notification-config.ts        NOTIFICATIONS_PAGE_SIZE (central config)
```

## API

| Method | Path                  | Description                          |
| ------ | --------------------- | ------------------------------------- |
| GET    | `/api/documents`      | List/search documents. `?search=` (or `?q=`), `?gradeId=`, `?subjectId=`, `?lessonId=`, `?documentType=`, `?sort=`, `?page=` — see [Search](#search). Legacy `?subject=`, `?take=`, `?skip=` still work |
| GET    | `/api/documents/:id`  | Get one document                      |
| POST   | `/api/documents`      | Create a document                     |
| PUT    | `/api/documents/:id`  | Update a document                     |
| DELETE | `/api/documents/:id`  | Delete a document                     |
| GET    | `/api/subjects`       | No `?gradeId=`: distinct legacy subjects with document counts (homepage). With `?gradeId=`: taxonomy Subjects for that Grade |
| POST   | `/api/auth/register`  | Register a new account. Always creates role `STUDENT` |
| *      | `/api/auth/[...nextauth]` | Auth.js sign-in/sign-out/session endpoints |
| POST   | `/api/documents/upload` | Upload a file + taxonomy metadata. TEACHER/ADMIN only, multipart form data |
| GET    | `/api/documents/:id/preview` | Streams the file inline for preview. Public — no auth. See [Preview](#preview) |
| GET    | `/api/documents/:id/download` | Streams the file as an attachment. Requires any signed-in user. See [Download](#download) |
| GET    | `/api/grades`         | All Grades ordered by `sortOrder`. See [Education Taxonomy](#education-taxonomy) |
| GET    | `/api/lessons`        | `?subjectId=...` — Lessons/Topics for one Subject |
| GET    | `/api/documents/:id/ratings` | Public. Rating summary: `averageRating`, `ratingCount`, `currentUserRating`. See [Rating](#rating) |
| PUT    | `/api/documents/:id/rating`  | Requires any signed-in user. Body `{ value: 1-5 }` — creates or updates the caller's own rating. See [Rating](#rating) |
| GET    | `/api/documents/:id/comments` | Public. Newest first, paginated. `?page=`. See [Comments](#comments) |
| POST   | `/api/documents/:id/comments` | Requires any signed-in user. Body `{ content: string }`. See [Comments](#comments) |
| PUT    | `/api/documents/:id/comments/:commentId` | Requires being the comment's own author. Body `{ content: string }`. See [Comments](#comments) |
| DELETE | `/api/documents/:id/comments/:commentId` | Requires being the comment's own author, or ADMIN. See [Comments](#comments) |
| POST   | `/api/documents/:id/reports` | Requires any signed-in user. Body `{ reason, description? }`. `409` on a duplicate OPEN report. See [Reporting](#reporting) |
| GET    | `/api/documents/:id/reports/mine` | Requires any signed-in user. Returns only the caller's own OPEN report reasons. See [Reporting](#reporting) |
| GET    | `/api/documents/:id/bookmark` | Requires any signed-in user. Returns `{ bookmarked }` for the caller only. See [Bookmarks](#bookmarks) |
| POST   | `/api/documents/:id/bookmark` | Requires any signed-in user. Idempotent — adds (or confirms) the caller's own bookmark. See [Bookmarks](#bookmarks) |
| DELETE | `/api/documents/:id/bookmark` | Requires any signed-in user. Removes the caller's own bookmark; safe if none exists. See [Bookmarks](#bookmarks) |
| GET    | `/api/teachers/:teacherId/follow` | Requires any signed-in user. Returns `{ following }` for the caller only. See [Follow](#follow) |
| POST   | `/api/teachers/:teacherId/follow` | Requires any signed-in user. Idempotent. `404` unless the target has role `TEACHER`; `400` on self-follow. See [Follow](#follow) |
| DELETE | `/api/teachers/:teacherId/follow` | Requires any signed-in user. Removes the caller's own follow; safe if none exists. See [Follow](#follow) |
| GET    | `/api/lessons/:lessonId/follow` | Requires any signed-in user. Returns `{ following }` for the caller only. See [Follow](#follow) |
| POST   | `/api/lessons/:lessonId/follow` | Requires any signed-in user. Idempotent. `404` if the Lesson doesn't exist. See [Follow](#follow) |
| DELETE | `/api/lessons/:lessonId/follow` | Requires any signed-in user. Removes the caller's own follow; safe if none exists. See [Follow](#follow) |
| GET    | `/api/notifications` | Requires any signed-in user. Own notifications only, paginated, newest first. `?page=`. `meta` includes `unreadCount`. See [Notifications](#notifications) |
| GET    | `/api/notifications/unread-count` | Requires any signed-in user. Returns `{ unreadCount }` for the caller only. See [Notifications](#notifications) |
| PATCH  | `/api/notifications/:id/read` | Requires any signed-in user. Marks the caller's own notification read; idempotent. `404` if it doesn't exist or belongs to someone else. See [Notifications](#notifications) |
| POST   | `/api/notifications/read-all` | Requires any signed-in user. Marks all of the caller's own unread notifications read. Returns `{ updatedCount }`. See [Notifications](#notifications) |

All responses use `{ success, data, error }` (plus `meta` for list pagination),
except `/api/documents/:id/preview` and `/api/documents/:id/download`, which
stream the raw file body on success (errors still use the standard envelope).
See [Search](#search) for the search/filter/sort/pagination contract.

## Auth

- Email/password login via Auth.js Credentials provider, JWT sessions.
- Roles: `STUDENT`, `TEACHER`, `ADMIN`. Public registration (`/register`)
  always creates `STUDENT` — the role is never accepted from the client.
  `ADMIN` is only a role foundation for future steps; there is no admin UI yet.
- Pages: `/register`, `/login`, `/profile` (requires auth, redirects guests to
  `/login`). Logout is a button in the header.
- Server-side authorization helpers in `src/lib/auth/authorize.ts`:
  `requireAuth()` and `requireRole("TEACHER")` / `requireRole(["TEACHER", "ADMIN"])`.
  Authorization is enforced server-side, never by hiding UI elements.
- Development seed accounts (created by `npm run db:seed`; this script
  refuses to run when `NODE_ENV=production` — see [Production](#production)):

  | Email | Password | Role |
  | --- | --- | --- |
  | student@example.com | student123 | STUDENT |
  | teacher@example.com | teacher123 | TEACHER |
  | admin@example.com | admin123 | ADMIN |

- Requires an `AUTH_SECRET` env var — see `.env.example` for how to generate one.
- Running in production mode (`npm start`) on any host other than Vercel
  also requires `AUTH_TRUST_HOST="true"` (already set in `.env.example`),
  or Auth.js rejects every request with `UntrustedHost`. Not needed for
  `npm run dev`.

## Education Taxonomy

- **Hierarchy:** `Grade → Subject → Lesson/Topic`, plus a controlled
  **Document Type** on every Document. A Subject belongs to exactly one
  Grade; a Lesson belongs to exactly one Subject (no many-to-many yet).
  Models live in `prisma/schema.prisma` (`Grade`, `Subject`, `Lesson`) and
  the `DocumentType` enum (`LECTURE`, `EXERCISE`, `EXAM`, `ANSWER`,
  `REFERENCE`, `OTHER`).
- **Read APIs** — `GET /api/grades` (ordered by `sortOrder`),
  `GET /api/subjects?gradeId=...`, `GET /api/lessons?subjectId=...`. Same
  `{ success, data, error }` envelope as the rest of the API.
- **Upload uses cascading selectors** (`TaxonomySelectFields`, a small client
  component) instead of free-text Subject/Document Type inputs: choosing a
  Grade loads its Subjects, choosing a Subject loads its Lessons; each
  `<select>` still submits via a plain form field, so no extra client state
  beyond the two parent IDs is needed.
- **Server-side hierarchy validation is mandatory, not just cascading
  dropdowns** — `validateTaxonomySelection()`
  (`src/lib/documents/taxonomy.ts`) re-checks every upload's
  `gradeId`/`subjectId`/`lessonId` against the database: the Subject must
  actually belong to the given Grade, and the Lesson must actually belong to
  the given Subject. A forged/inconsistent combination (e.g. a Grade 12
  upload paired with a Subject that's actually under Grade 11) is rejected
  with `400`, regardless of what the client sent.
- **Backward compatibility:** `Document.gradeId`/`subjectId`/`lessonId` are
  all nullable — documents created before this taxonomy (or via the legacy
  `subject` free-text field) keep rendering with their existing `subject`
  text and a `documentType` migrated into the new enum. New taxonomy-backed
  uploads also populate the legacy `subject` field automatically (copied
  from the taxonomy Subject's name), so homepage/search subject grouping —
  which still reads that field — keeps working unchanged for both legacy
  and taxonomy-backed documents without a redesign.

## Search

- **Filter hierarchy:** `Grade → Subject → Lesson/Topic`, plus **Document
  Type** — the same taxonomy as upload (see [Education
  Taxonomy](#education-taxonomy)). Filters combine with AND logic, and the
  keyword combines with whatever filters are active. Selecting a new Grade
  resets Subject and Lesson; selecting a new Subject resets Lesson — enforced
  by `SearchFilters.tsx`, which fetches Subject/Lesson options from the
  existing `/api/subjects?gradeId=`/`/api/lessons?subjectId=` taxonomy APIs
  (no duplicated taxonomy data in the frontend).
- **The URL is the source of truth**, not React state: `q`, `gradeId`,
  `subjectId`, `lessonId`, `documentType`, `sort`, `page`. Copying a filtered
  search URL into a fresh browser session restores the exact same
  keyword/filters/sort/page — every filter `<select>` reads its value
  directly from `useSearchParams()` and pushes a new URL on change (via
  `next/navigation`'s `router.push`), rather than keeping its own committed
  state.
- **Sort options:** `newest` (default), `oldest`, `title_asc`, `title_desc`.
  The URL's `sort` value is only ever looked up in an explicit allowlist
  (`SORT_ORDER_BY` in `src/lib/documents/search-query.ts`) before being
  passed to Prisma's `orderBy` — an unrecognized value falls back to
  `newest` rather than being passed through.
- **Pagination:** server-side, via Prisma `skip`/`take` + `count()` — never
  loaded into memory and paginated in JS. Page size is centralized as
  `SEARCH_PAGE_SIZE` in `src/lib/documents/search-query.ts` (currently `12`);
  the API response `meta` includes `page`, `pageSize`, `total`, and
  `totalPages` for the page-based search flow. Changing the keyword, any
  filter, or the sort always resets to page 1. The legacy `?take=`/`?skip=`
  offset pagination (used by the homepage's "popular documents" query) keeps
  working unchanged side-by-side with the new page-based flow.
- **Query parsing is centralized**, not duplicated between the page and the
  API route — `parseSearchQuery()` (`src/lib/documents/search-query.ts`) is a
  pure function shared by both `GET /api/documents` (where the keyword
  arrives as `search`) and `/search` (where it arrives as `q`); this is the
  one place that `q`↔`search` translation happens.
- **Untrusted filter combinations are validated server-side, not just
  trusted from the URL** — `resolveSearchTaxonomyFilters()`
  (`src/lib/documents/search-filters.ts`) re-checks every `gradeId`/
  `subjectId`/`lessonId` against the database on every request. Unlike
  upload's `validateTaxonomySelection()` (which rejects a bad combination
  outright), this resolver is tolerant: a Subject that doesn't belong to the
  selected Grade, or a Lesson that doesn't belong to the selected Subject,
  is silently dropped rather than erroring — the search just becomes
  broader instead of crashing or leaking a DB error. An invalid `sort` or
  `page` is normalized the same way (falls back to `newest` / `1`).
- **Legacy documents** (no `gradeId`/`subjectId`/`lessonId`) remain fully
  searchable by keyword when no taxonomy filter is active; selecting a
  taxonomy filter naturally excludes them, the same way it excludes any
  other non-matching Document — no special-casing needed.
- **Homepage compatibility:** the homepage's "Browse by subject" and
  "Popular documents" sections are untouched — they still use the legacy
  `?subject=` grouping and `?take=` offset pagination respectively, both of
  which keep working exactly as before alongside the new filters.
- **Empty results / Clear filters:** a friendly "No documents found for
  these filters" state (with a link back to the unfiltered `/search`)
  replaces the default error state for a valid empty result. A "Clear
  filters" link appears whenever any filter is active, resetting Grade/
  Subject/Lesson/Document Type/Sort/page back to default while preserving
  the keyword.

## Uploads

- Only `TEACHER` and `ADMIN` may upload, enforced server-side (`hasRole`/`requireRole`)
  in both `/upload` and `POST /api/documents/upload` — hiding the header link for
  other roles is UX only, not the security boundary.
- **Local filesystem storage — no external service or credentials required.**
  Uploaded files are written under `storage_local/` at the project root,
  created automatically on first upload:

  ```
  storage_local/
    pdf/       .pdf
    word/      .doc, .docx
    excel/     .xls, .xlsx
    images/    .jpg, .jpeg, .png, .webp
    videos/    .mp4, .webm
  ```

- The allowlist above (extension → category → accepted MIME type) lives in
  `src/lib/storage/local-storage.ts` and is the only place that decides what's
  supported. Every upload is validated server-side: extension is on the
  allowlist, the declared `Content-Type` matches that extension, size is
  within the configured limit, and — for formats with a practical signature —
  the file's actual first bytes match (PDF, PNG, JPEG, WEBP, DOCX/XLSX,
  DOC/XLS, MP4, WEBM). A spoofed content type or renamed extension alone
  isn't trusted.
- Default max upload size is **10 MB**, defined once in
  `src/lib/documents/upload-config.ts` (`MAX_UPLOAD_SIZE_MB` /
  `MAX_UPLOAD_SIZE_BYTES`) — every validation path reads from there, so
  changing the limit means editing one file.
- Each file is stored under a server-generated key, never the original
  filename: `{category}/{uuid}.{ext}` (e.g. `pdf/550e8400-....pdf`). Only the
  relative key is stored in the database (`fileKey`) — never an absolute
  filesystem path or a permanent public URL. `uploadedById` always comes from
  the authenticated session — it's never accepted from the client.
- If the local file write fails, no `Document` row is created. If the
  `Document` row fails to save *after* a successful write, the app attempts
  to delete the now-orphaned file. Written files use an exclusive write flag
  (never silently overwrite), and storage paths are resolved with a
  containment check that rejects anything (e.g. `../..`) that would escape
  `storage_local/`.
- **Known MVP limitation:** files live on the app server's local disk. This
  is fine for a single-instance VPS setup — see [Production](#production) for
  keeping that disk persistent and outside the release directory — but does
  **not** survive redeploys on serverless/ephemeral-filesystem hosts and
  won't be shared across multiple app instances — swapping in a real storage
  backend later only requires changing `src/lib/storage/local-storage.ts`,
  since nothing else in the app talks to the filesystem directly.

## Preview

- **Public — no login required.** Anyone, including guests, can preview a
  document's file from `/documents/[id]`. The page never calls `requireAuth()`
  or `requireRole()` for preview.
- **Supported inline preview:** PDF (browser-native PDF viewer via `<iframe>`),
  images — JPG/JPEG/PNG/WEBP (`<img>`), video — MP4/WEBM (native HTML5
  `<video controls>`, no autoplay), and modern Word — `.docx` only, rendered
  in-browser with the `docx-preview` library (`src/components/DocxPreview.tsx`,
  dynamically imported client-side, never during SSR). Video preview supports
  HTTP `Range` requests (`206 Partial Content`) so browser seeking works.
- **Not yet supported:** legacy Word `.doc` and Excel (`.xls`/`.xlsx`) show a
  friendly "preview is not available yet" placeholder instead of a broken
  viewer — no Google Docs/Office Online/LibreOffice conversion involved. `.doc`
  and `.docx` share the same `WORD` file category, so which one is
  previewable is decided by the stored `mimeType`
  (`src/lib/documents/preview-kind.ts`), not the filename.
- **Served entirely through the backend** — `GET /api/documents/:id/preview`
  takes only a Document ID, looks up its `fileKey` in Postgres server-side,
  and resolves it through the same containment-checked path resolution used
  by uploads. `storage_local/` is never exposed as a static/public folder and
  is not under `public/` — there is no URL that lets the browser pick a
  filesystem path directly.
- **Preview ≠ download:** the response has no `Content-Disposition:
  attachment`, so supported types render inline. Downloading the original
  file is a separate, protected endpoint — see [Download](#download).

## Download

- **Requires being signed in — any role.** STUDENT, TEACHER, and ADMIN can
  all download; guests cannot. `GET /api/documents/:id/download` calls
  `auth()` directly (no `requireRole()` — no specific role is required) and
  returns `401` for a guest request. The page never relies on hiding the
  Download button as the security boundary.
- **Guest flow:** the Download button is still a plain link, not disabled —
  it points at `/login?callbackUrl=/documents/:id`. After a successful login
  the user lands back on that same document (not the homepage) and can click
  Download again; there's no auto-download after login.
- **Safe callback URLs only** (`src/lib/auth/callback-url.ts`) —
  `isSafeCallbackUrl()` accepts only an internal root-relative path and
  rejects anything that could redirect off-site (`https://...`,
  `//evil.example.com`, backslash tricks, `javascript:`). An unsafe or
  missing `callbackUrl` just falls back to the normal post-login redirect
  (`/`).
- **Original filename, not the storage key** — the response's
  `Content-Disposition: attachment` uses `Document.fileName` (the name the
  uploader's browser originally sent), built safely by
  `buildContentDisposition()` (`src/lib/documents/content-disposition.ts`):
  control characters/quotes are stripped or escaped, and a UTF-8
  `filename*=` parameter is included for non-ASCII names. The generated
  `fileKey` (`pdf/550e8400-....pdf`) is never exposed to the browser as a
  filename.
- **Same safe file resolution as preview** — reuses
  `statLocalFile`/`createLocalFileReadStream` from
  `src/lib/storage/local-storage.ts` (no duplicated path logic): Document ID
  → DB `fileKey` → containment-checked resolution under `storage_local/` →
  file bytes. `storage_local/` stays off-limits as a static/public folder,
  exactly as for preview.
- **Works for every supported upload format**, independent of preview
  support — DOC and XLS/XLSX download even though they have no preview.
- **A document with no uploaded file** always keeps the Download button
  disabled (a real `<button disabled>`, not a link) for every visitor,
  logged in or not — a missing file is never confused with "you need to log
  in."
- **Preview is untouched and stays public** — the download endpoint is a
  fully separate route; `GET /api/documents/:id/preview` still never calls
  `auth()`/`requireAuth()`/`requireRole()`.

## Rating

- **1-5 stars, one rating per user per document.** `DocumentRating`
  (`prisma/schema.prisma`) has a `@@unique([documentId, userId])`
  constraint — a user rating the same document twice always updates their
  existing row (via Prisma `upsert`), never creates a second one. Deleting a
  Document or User cascades to their ratings.
- **Reading is public — no login required.** `GET /api/documents/:id/ratings`
  never calls `auth()`/`requireRole()`; it returns `averageRating` (`null`
  when there are no ratings yet — never `0`, since a real average can't be
  below `1`), `ratingCount`, and `currentUserRating` (the caller's own
  rating if signed in, otherwise `null`).
- **Submitting requires being signed in — no role restriction.**
  `PUT /api/documents/:id/rating` calls `auth()` directly (STUDENT, TEACHER,
  and ADMIN can all rate) and returns `401` for a guest. `userId` always
  comes from the session; the request body may only contain `value` — it's
  never accepted from the client, so a submission can never be attributed
  to a different user. `documentId` comes from the route, and rating a
  nonexistent Document returns `404`.
- **Validated server-side, not trusted from the client** — `value` must be
  an integer from 1 to 5 (`src/lib/validation/rating.ts`); `0`, `6`,
  negatives, decimals, strings, `null`, and a missing value are all
  rejected with a friendly `400`, matching the rest of the app's zod
  validation style.
- **Aggregates are always computed on read** via Prisma/PostgreSQL
  `aggregate()` (`getRatingSummary()`,
  `src/lib/documents/rating.ts`) — never by loading every rating row into
  memory, and never cached on `Document` itself. The average is rounded to
  1 decimal place for display (e.g. `4.7`).
- **Document Detail UI** (`DocumentRatingSection.tsx` +
  `StarRating.tsx`, both under `src/components/`): shows the average,
  rating count, and a 5-star control. Guests see a read-only star cluster
  (the rounded average) wrapped in a plain link to
  `/login?callbackUrl=/documents/:id` — clicking never submits a rating
  before login, it only navigates there (same safe-callback pattern as
  [Download](#download), via the shared `documentLoginHref()` helper).
  Signed-in users get real interactive stars (`role="radiogroup"`, keyboard
  operable) that `PUT` straight to the rating endpoint, then re-fetch the
  summary to update the displayed average/count/selection — no
  optimistic-update or client-cache library involved, just submit → response
  → refetch.
- **Feedback via the existing Sonner system** — a first-time rating shows
  "Rating submitted successfully", changing an existing rating shows
  "Rating updated successfully"; a failed submission shows a generic
  "Unable to save your rating." toast without exposing any Prisma/database
  detail.
- **Not built yet:** reports, rating-based search sorting, and a rating
  analytics dashboard — see `FEATURES.md`.

## Comments

- **Flat, single-level comments — no replies/threads.** `DocumentComment`
  (`prisma/schema.prisma`) links a Document and a User; deleting either
  cascades to their comments. Content is plain text, capped at
  `COMMENT_MAX_LENGTH` (1000, `src/lib/documents/comment-config.ts`) — never
  parsed or rendered as HTML (no `dangerouslySetInnerHTML` anywhere in the
  comment UI), so pasting something like `<script>...</script>` just
  displays as literal text.
- **Reading is public — no login required.**
  `GET /api/documents/:id/comments` never calls `auth()`/`requireRole()`.
  Newest first, paginated at `COMMENTS_PAGE_SIZE` (20,
  same config file) — never an unbounded query; the total comment count
  comes from a DB `count()`, not from counting the returned page. Each
  comment's `author` only ever exposes `id`/`name`/`role` — never `email`
  or `passwordHash`.
- **Posting requires being signed in — no role restriction.**
  `POST /api/documents/:id/comments` calls `auth()` directly (STUDENT,
  TEACHER, and ADMIN can all comment) and returns `401` for a guest.
  `userId` always comes from the session; the request body may only
  contain `content`. Commenting on a nonexistent Document returns `404`.
- **Editing is owner-only, even for ADMIN.**
  `PUT /api/documents/:id/comments/:commentId` returns `403` for anyone but
  the comment's own author — moderation is done via delete, never by an
  admin impersonating someone else's edit. `updatedAt` changes on edit;
  `createdAt` never does.
- **Deleting allows the owner or ADMIN.**
  `DELETE /api/documents/:id/comments/:commentId` allows the comment's own
  author (any role) or any ADMIN; everyone else gets `403`, a guest gets
  `401`. Both routes verify the comment actually belongs to the `:id` in
  the URL — a comment from a different Document can't be edited/deleted
  through the wrong Document's route (treated as `404`, matching a
  genuinely missing comment, so no cross-Document existence is leaked).
- **Validated server-side, not trusted from the client** — content is
  required, trimmed, rejected if empty/whitespace-only or over
  `COMMENT_MAX_LENGTH` (`src/lib/validation/comment.ts`), matching the
  rest of the app's zod validation style.
- **Document Detail UI** (`CommentSection.tsx` + `CommentForm.tsx` +
  `CommentItem.tsx`, all under `src/components/`), placed after Download:
  a `Comments (N)` header, a plain textarea + submit for signed-in users
  (character count, disabled while empty or submitting — no rich-text
  editor), and a "Log in to leave a comment" link
  (`documentLoginHref()`, the same helper Download/Rating use) for guests.
  Each comment shows author name, a role Badge, a formatted date, and
  (when applicable) inline Edit/Delete — Edit swaps the text for a
  textarea with Save/Cancel; Delete shows a lightweight inline "Delete
  this comment?" confirmation instead of the browser's `window.confirm()`.
- **Feedback via the existing Sonner system** — "Comment posted
  successfully" / "Comment updated successfully" / "Comment deleted
  successfully" on success; "Unable to save comment" /
  "Unable to delete comment" on failure, without exposing any
  Prisma/database detail.
- **Not built yet:** replies/nested threads, mentions, rich text, images,
  and likes — see `FEATURES.md`.

## Reporting

- **Any signed-in user may report any Document** — STUDENT, TEACHER, and
  ADMIN, with no ownership restriction (a TEACHER/ADMIN may report a
  Document they uploaded themselves). Guests see the Report action but
  can't submit: clicking it goes to `/login?callbackUrl=/documents/:id`
  (`documentLoginHref()`, the same helper Download/Rating/Comments use) —
  nothing is ever submitted before login.
- **Controlled reasons only** (`ReportReason` enum,
  `src/lib/documents/report-reason.ts`): Broken file, Wrong content, Wrong
  grade/subject/lesson, Preview issue, Duplicate document, Copyright
  issue, Other — never arbitrary free text.
- **Description is optional, except required for Other** — trimmed,
  capped at `REPORT_DESCRIPTION_MAX_LENGTH` (1000,
  `src/lib/documents/report-config.ts`), rejected if whitespace-only when
  the reason is Other. Plain text only, same as Comments — never parsed
  as HTML.
- **At most one OPEN report per (Document, user, reason)** — enforced two
  ways: the API pre-checks for an existing OPEN match and returns a
  friendly `409` ("You have already reported this issue."), and a
  hand-written partial unique index on `DocumentReport(documentId,
  userId, reason) WHERE status = 'OPEN'` (Prisma's schema DSL can't
  express a `WHERE` clause on `@@unique`, so this one migration statement
  is raw SQL) catches the same case if two submissions race. A report
  that's later `RESOLVED`/`DISMISSED` never blocks a new `OPEN` one for
  the same reason — the index only covers `OPEN` rows. The same user may
  still report a *different* reason on the same Document at any time.
- **Report status foundation only** — `ReportStatus` (`OPEN` default,
  `RESOLVED`, `DISMISSED`) exists on the model, but this step only ever
  creates `OPEN` reports. There is no resolve/dismiss action, no admin
  notes, no `/admin/reports` moderation UI, and no email notifications
  yet — reports are stored for a future Admin moderation step.
- **Ownership is server-controlled** — `documentId` always comes from the
  route, `userId` always from the session, and `status` is always `OPEN`
  on create; the client body may only contain `reason`/`description`.
  Reporting a nonexistent Document returns `404`.
- **UI on Document Detail** (`ReportDocumentAction.tsx`), placed after
  Download and styled as a small secondary text link — never competing
  visually with Preview/Download. Clicking it expands an inline form
  (reason `<select>` + optional/required description textarea) rather
  than opening a modal, matching this app's existing hand-rolled
  shadcn-style primitives (no new dialog dependency). The reason list
  optionally hints "(already reported)" next to a reason the user already
  has an OPEN report for, via a small authenticated
  `GET /api/documents/:id/reports/mine` endpoint that only ever returns
  the caller's own report reasons.
- **Feedback via the existing Sonner system** — "Report submitted
  successfully" on success, "You have already reported this issue" on a
  `409`, "Unable to submit report" on any other failure — without
  exposing any Prisma/database detail. The Report action itself is never
  permanently disabled after one submission.

## Bookmarks

- **Any signed-in user may save (bookmark) any Document** — STUDENT,
  TEACHER, and ADMIN, one bookmark per user per Document
  (`@@unique([documentId, userId])` on `DocumentBookmark`). Guests see
  the Save action but can't use it: clicking it goes to
  `/login?callbackUrl=/documents/:id` (same `documentLoginHref()` helper
  Download/Rating/Comments/Reporting use) — nothing is ever saved before
  login.
- **Adding is idempotent** — `POST /api/documents/:id/bookmark` does a
  Prisma `upsert` on the `(documentId, userId)` key, so a duplicate
  request is a safe no-op, never a second row or an error. Removing
  (`DELETE`) uses `deleteMany`, which matches zero rows without throwing
  if there's nothing to remove.
- **Ownership is server-controlled** — `documentId` always comes from the
  route, `userId` always from the session; neither endpoint reads a
  request body at all, so there's no field for a client to spoof.
  Bookmarking a nonexistent Document returns `404`.
- **Bookmarks are completely private per user** — `GET
  /api/documents/:id/bookmark` returns only the caller's own `{
  bookmarked }` state, and `/saved` only ever queries the signed-in
  user's own bookmarks. There is no global bookmark count, no popularity
  ranking, and no bookmark-based trending — see `FEATURES.md`.
- **Document Detail UI** (`BookmarkAction.tsx`) — a small heart-icon
  toggle next to the rating control: outline "Save document" when not
  saved, filled "Saved" once it is. Clicking toggles state, calls the
  API, and shows a toast — no optimistic UI.
- **`/saved`** — requires auth (`/login?callbackUrl=/saved` for guests,
  via the same `loginHrefFor()` helper `documentLoginHref()` is built
  from). Lists the current user's saved documents newest-saved-first
  (`Bookmark.createdAt`, not `Document.createdAt`), reusing `DocumentCard`
  and the same pagination pattern as `/search`. Server-side pagination is
  capped at `SAVED_PAGE_SIZE` (12,
  `src/lib/documents/bookmark-config.ts`) — never an unbounded query. A
  "Saved" link appears in the header for any signed-in user.
- **Feedback via the existing Sonner system** — "Document saved" /
  "Document removed from saved items" on success, "Unable to update
  saved document" on failure.
- **Not built yet:** bookmark counts, trending-by-bookmark, collections/folders,
  and social sharing — see `FEATURES.md`.

## Follow

- **Two independent follow relationships** — Follow Teacher
  (`TeacherFollow`, unique on `(followerId, teacherId)`) and Follow Lesson
  (`LessonFollow`, unique on `(userId, lessonId)`). Any signed-in user —
  STUDENT, TEACHER, or ADMIN — can follow either kind; guests see the
  action but clicking it goes to `/login?callbackUrl=...` (same
  `loginHrefFor()`/`documentLoginHref()` helper every other guest-facing
  action uses) — nothing is ever followed before login, and login never
  auto-follows afterward.
- **Only a `role = TEACHER` User can be a Teacher-follow target** —
  `POST /api/teachers/:teacherId/follow` looks the target up and checks
  its role; a STUDENT/ADMIN id and a nonexistent id both return `404`
  identically, so the endpoint never confirms whether an arbitrary user
  id exists. One TEACHER may freely follow a different TEACHER.
- **Self-follow is blocked** — a TEACHER cannot follow themselves
  (`followerId === teacherId` is rejected with a friendly `400` before
  any database lookup); the UI hides the Follow action entirely on a
  Document uploaded by the viewer.
- **Adding is idempotent, removing is safe** — both `POST` endpoints
  `upsert` on their compound unique key (a repeat follow never creates a
  second row); both `DELETE` endpoints use `deleteMany` (matches zero
  rows without throwing if there's nothing to remove). Neither endpoint
  reads a request body — `teacherId`/`lessonId` come from the route,
  `followerId`/`userId` from the session, so there's no field for a
  client to spoof.
- **Document Detail UI** — `TeacherFollowAction.tsx` appears next to the
  uploader's name in the file metadata block, but only when
  `uploadedBy.role === "TEACHER"` (never for a legacy/STUDENT-uploaded
  Document). `LessonFollowAction.tsx` appears next to the Lesson name in
  the taxonomy metadata row, but only when the Document has a structured
  Lesson (never for legacy Documents with no Lesson relation). Both are
  small secondary text links, not buttons — they never compete visually
  with Preview/Download.
- **`/following`** — requires auth (`/login?callbackUrl=/following` for
  guests). Two sections, **Followed Teachers** and **Followed Lessons**,
  each ordered newest-followed-first (the follow row's own `createdAt`,
  not the Teacher/Lesson's creation date) and paginated independently via
  `?teachersPage=`/`?lessonsPage=`, capped at `FOLLOWING_PAGE_SIZE` (12,
  `src/lib/follow/follow-config.ts`) — never an unbounded query. Each
  list only ever queries the signed-in user's own follows — no other
  user's Following list is ever exposed. Teachers show name + document
  count (an efficient Prisma `_count`, no N+1) — never email. Lessons
  show Grade/Subject/Lesson name. Clicking "Unfollow" removes the item
  from the current page instantly. A "Following" link appears in the
  header for any signed-in user.
- **No follower counts anywhere** — neither Teacher nor Lesson exposes a
  public follower count, popularity ranking, or recommendation surface;
  the follow tables exist so a future Admin/notification step can query
  "who follows this Teacher/Lesson," not to display counts now.
- **Feedback via the existing Sonner system** — "Teacher followed" /
  "Teacher unfollowed" / "Lesson followed" / "Lesson unfollowed" on
  success, "Unable to update follow status" on failure.
- **Not built yet (this step):** the follow relationships themselves don't
  notify anyone — see [Notifications](#notifications) below for what
  consumes them. See `FEATURES.md`.

## Notifications

- **In-app only, triggered by new Document uploads (Step 8C)** — a
  `Notification` row is created for a user when a newly-uploaded Document
  matches something they follow: they follow the uploading Teacher (only
  when the uploader has `role = TEACHER` — a STUDENT/ADMIN upload never
  triggers a Teacher-follow notification), or they follow the Document's
  Lesson (only when the Document has a structured Lesson). No comment,
  rating, or report notifications yet, and no email/push delivery.
- **Generated from inside the existing upload flow** — `uploadDocument()`
  (`src/lib/documents/upload.ts`) calls `createNewDocumentNotifications()`
  right after the Document row is successfully created. This call has its
  own try/catch, entirely separate from the Document-creation try/catch
  above it: if notification generation throws, the error is logged and
  swallowed — the Document that was already saved is never rolled back,
  deleted, or reported as a failed upload.
- **Recipients are deduplicated, and the uploader is always excluded** —
  the Teacher-follower set and the Lesson-follower set are combined into a
  single `Set` of user ids before any row is written, so a user following
  both the Teacher and the Lesson still gets exactly one notification for
  that Document. The uploader's own id is removed from that set even if
  they follow their own Teacher profile or Lesson, so no one is ever
  notified about their own upload.
- **Idempotent generation** — `@@unique([userId, documentId, type])` on
  `Notification`, paired with `createMany({ skipDuplicates: true })`,
  means calling the generator more than once for the same Document never
  creates duplicate rows.
- **No historical backfill** — this only applies to new uploads from this
  step forward; existing Documents never retroactively generate
  notifications.
- **Notifications are completely private per user** — `GET
  /api/notifications`, `GET /api/notifications/unread-count`, and
  `/notifications` only ever query the signed-in user's own rows;
  `userId` always comes from the session, never from a query/body param.
  Marking one notification read (`PATCH /api/notifications/:id/read`)
  checks ownership first — a notification that doesn't belong to the
  caller (or doesn't exist) returns `404` either way, and a repeat mark-read
  is a safe no-op. `POST /api/notifications/read-all` only ever updates
  the caller's own unread rows.
- **Content is server-generated plain text, never HTML** — e.g. `Teacher
  Nguyen Van A uploaded "Derivative Exercises" for Derivatives.` for a
  TEACHER upload, or `A new document "Derivative Exercises" was added to
  Derivatives.` for an ADMIN upload. The client never supplies or
  influences notification title/message text.
- **`/notifications`** — requires auth (`/login?callbackUrl=/notifications`
  for guests, via the same `loginHrefFor()` helper every other guest-facing
  action uses). Lists the signed-in user's own notifications newest first,
  paginated at `NOTIFICATIONS_PAGE_SIZE` (20,
  `src/lib/notifications/notification-config.ts`). Unread notifications
  get a subtle tinted background, a small accent dot, and slightly bolder
  title text — never anything aggressive. A "Mark all as read" button
  appears only when there's at least one unread notification.
- **Clicking a notification** (`NotificationItem.tsx`) marks it read (a
  fire-and-forget `PATCH`) and navigates to `/documents/:id` via a normal
  `<Link>`; `router.refresh()` keeps the header bell's count in sync on
  the next render, without any global client state.
- **Header bell** (`SiteHeader.tsx`) — a Bell icon, authenticated users
  only, with a small unread-count badge (capped display at `99+`) that
  disappears entirely once `unreadCount` is `0`. Links to `/notifications`.
- **Feedback via the existing Sonner system** — "All notifications marked
  as read" on a successful "Mark all as read"; "Unable to update
  notifications" on failure.
- **Not built yet:** email notifications, push notifications, notification
  preferences/subscriptions beyond Follow Teacher/Lesson, comment/rating/
  report notifications, and any AI — see `FEATURES.md`.

## Production

Step 13A — production-readiness configuration for a single Ubuntu VPS
(Nginx → `127.0.0.1:3000` → Next.js → local PostgreSQL). This step only
changes configuration/operations, not product behavior — see
`FEATURES.md`. Later sub-steps (systemd/deploy scripts, Nginx config itself,
security hardening, backups) are explicitly out of scope here.

### Production start sequence

```bash
npm ci
npm test
npx tsc --noEmit
npx prisma generate
npm run db:migrate:deploy
npm run build
npm start
```

Build and runtime should use the **same** production `.env` — see
`MAX_UPLOAD_SIZE_MB` below for why a mismatch between the env used at
`npm run build` time and at `npm start` time can silently produce an
inconsistent upload-size ceiling.

### Binds to `127.0.0.1:3000` only

`npm start` runs `next start -H 127.0.0.1`, not plain `next start`. Plain
`next start` binds to all interfaces (`*:3000`/`0.0.0.0:3000`) by
default — verified directly: starting it without the flag showed
`TCP *:3002 (LISTEN)` in the socket table, while `npm start` shows only
`TCP 127.0.0.1:3000 (LISTEN)`. Nginx (Step 13B) will proxy to
`127.0.0.1:3000`; the app itself never listens publicly, so a firewall
misconfiguration alone can't expose it directly. `npm run dev` is
unaffected — development keeps its normal bind behavior. The port stays
configurable via the standard `PORT` env var (only the hostname is forced).

### Centralized env config, split for client/server safety

`src/lib/env-core.ts` holds all the actual `process.env` reading/validation
logic and has **no** `"server-only"` guard, because `next.config.ts` and the
CLI scripts under `prisma/` (run via `tsx`) both need it directly, and
neither loading context tolerates the `server-only` package (confirmed via
real `next build`/`tsx` failures otherwise). `src/lib/env.ts` re-exports
everything from `env-core.ts` behind a `"server-only"` guard — real Next.js
app code (Server Components, API routes, other server-only lib modules)
imports from `@/lib/env`, so an accidental import from a Client Component
still fails loudly at build time. No function here returns or logs a
secret value — `getStorageRoot()`/`getMaxUploadSizeMB()`/`getAppUrl()`
return infrastructure config, not credentials, and `validateProductionEnv()`
only ever reports *which* variable is missing/invalid, never the value of
`DATABASE_URL`/`AUTH_SECRET`.

`validateProductionEnv()` runs once from `next.config.ts` — which Next.js
loads before anything else for `next build` and `next dev`/`next start`
alike — and throws a single combined error listing everything missing or
invalid when `NODE_ENV=production`. A no-op outside production; dev/test
are never affected.

- **`STORAGE_ROOT`** — an absolute path for persistent upload storage,
  required when `NODE_ENV=production` (a relative path is also rejected).
  Development keeps using `./storage_local` (unchanged) when this is unset.
  Intended VPS layout: source at `/var/www/school-library/current`, storage
  at `/var/lib/school-library/storage` — kept outside the release directory
  so a new deploy can never delete uploaded files. Nothing else about
  upload/download/preview behavior changes — see [Uploads](#uploads).
- **`MAX_UPLOAD_SIZE_MB`** — optional; unset intentionally defaults to 10
  (unchanged). If set, it's parsed by one shared function used by both the
  runtime getter and `validateProductionEnv()`, so "unset" (→ default 10,
  never an error) and "set but invalid" are never confused: zero, negative,
  and non-numeric values are all rejected with a clear
  `next build`/`next start` failure in production, never silently coerced
  to 10. Consumed in two places with two different timings — read by
  `src/lib/documents/upload-config.ts` at server **start** (a restart alone
  picks up a new value there) and baked into `next.config.ts`'s Server
  Action body-size ceiling at **build** time (raising the limit only takes
  effect there after a full `next build`, not just a restart) — this is why
  the build-time and runtime `.env` must match; a build done with a lower
  value than the one used at start time leaves the framework's hard ceiling
  below the app's own limit for the Server Action upload path.
- **`APP_URL`** — optional, and not required in production. Audited: no
  request path in the app currently reads it (the self-fetch pattern that
  used to need an absolute base URL was removed for performance — see
  [Uploads](#uploads)/api-client.ts history). Kept only as documented,
  *validated-if-set* config for ops (what Nginx's `server_name`/proxy target
  should match) and any future absolute-URL need. When set, it must be a
  valid `http://` or `https://` URL — anything else fails
  `validateProductionEnv()` with a clear message; production should
  normally use `https://` once Step 13B/HTTPS is in place, though that's
  not yet enforced since the app doesn't consume the value at all.
- **Production migrations** — `npm run db:migrate:deploy` (`prisma migrate
  deploy`) applies pending migrations non-interactively; use this on the
  VPS instead of `npm run db:migrate` (`prisma migrate dev`), which is
  dev-only and can prompt/reset.
- **Seed is production-blocked** — `prisma/seed.ts` refuses to run (exits
  non-zero, touches the database not at all — the check runs before any
  query) when `NODE_ENV=production`, since it deletes all Documents/Users
  and recreates demo accounts with the public, well-known passwords
  documented in [Auth](#auth) above. This is a hard fail, not a warning or
  a confirmation prompt — there is no "continue anyway". Local development
  is unaffected.
- **First production ADMIN** — `npm run create-admin`
  (`prisma/create-admin.ts`) interactively prompts for name/email/password
  (password not echoed when run at a real terminal; falls back to a visible
  prompt only for piped/non-TTY input) and creates one `ADMIN` user, reusing
  the same validation as public registration. Never prints the password or
  its hash back, at any point. There is no Admin registration page and no
  API route for this — it's a one-time CLI step only. Refuses a duplicate
  email; exits non-zero on any failure. Requires `tsx`, a devDependency —
  keep dev dependencies installed for this one command even in an otherwise
  production-pruned install.
- **`GET /api/health`** — public, for VPS monitoring/deploy verification.
  Checks the process is up and PostgreSQL is reachable (`SELECT 1`). Returns
  `{ status: "ok" | "error", checks: { database: "ok" | "error" } }` with
  `200`/`503`. Never includes `DATABASE_URL`, filesystem paths, secrets, or
  stack traces — failures are logged in full server-side only. Intentionally
  minimal — no dependency/monitoring-integration checks beyond the database.
- **Logging** — audited every `console.error`/`console.log` call in `src/`
  and `prisma/`: server-side logs include full error objects (useful for
  troubleshooting via journald in Step 13B), but never a password,
  `AUTH_SECRET`, session token, or `Authorization` header — the credentials
  `authorize()` path (`src/lib/auth/authenticate.ts`) logs nothing at all.
  User-facing API responses stay generic, as in every other step.
- **Node.js 24 LTS** — `package.json`'s `engines.node` is `">=24 <25"` (not
  the previously-broad `>=22`, which would also silently accept a future
  major), matched by `.nvmrc` (`24`). Both were verified: the full Vitest
  suite, `tsc --noEmit`, and `next build`/`npm start` all genuinely ran
  under a real Node 24.19.0 install (not just checked against Next.js's
  declared `engines` range), alongside this environment's own Node 26.0.0 —
  both pass identically.
- **Verified (all live, not just described):** full Vitest suite,
  `tsc --noEmit`, and `next build` pass on both Node 24 and Node 26 with
  `STORAGE_ROOT`/`AUTH_TRUST_HOST` set; `next build` correctly **fails**
  with a clear, specific error for each of: missing `STORAGE_ROOT`, a
  relative `STORAGE_ROOT`, `MAX_UPLOAD_SIZE_MB` set to `0`/negative/
  non-numeric, and an invalid `APP_URL` — each checked individually.
  `npm start` was run against a real Postgres with a temporary
  `STORAGE_ROOT`: the socket table confirmed `127.0.0.1:3000` only (no
  `0.0.0.0`/wildcard), `curl http://127.0.0.1:3000` and `/api/health` both
  returned `200`, login worked, an uploaded file landed in the configured
  `STORAGE_ROOT` (confirmed on disk) and was readable via preview/download,
  `NODE_ENV=production npm run db:seed` failed before touching the database
  (row counts confirmed unchanged), and `create-admin` created a working
  `ADMIN` account, allowed login, and correctly rejected a duplicate email.
  All verification data was deleted afterward.
- **Not built yet (later sub-steps):** systemd unit files, deployment
  scripts, release-directory automation, Nginx config, security headers,
  rate limiting, and backup/restore tooling — see `FEATURES.md`.
