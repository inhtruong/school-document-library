# Stacks — school document library (step 1)

Homepage → search → search results → document detail, backed by a real
PostgreSQL database through a Prisma-powered REST API. Authentication
(email/password via Auth.js) with STUDENT/TEACHER/ADMIN roles is implemented.
Teachers and admins can upload documents (PDF, Word, Excel, images, video) to
local file storage. Anyone — including guests — can preview PDF, image,
video, and modern Word (`.docx`) files directly from the document detail
page; legacy `.doc` and Excel show an "unsupported yet" placeholder. No real
download or AI yet.

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
npm run dev          start the Next.js dev server
npm run build         production build
npm run db:generate   regenerate the Prisma client
npm run db:migrate    create/apply a migration (dev)
npm run db:seed       reset and reseed sample documents
npm run db:studio     open Prisma Studio to browse the database
npm test               run the Vitest suite
```

## What's here

```
storage_local/        uploaded files, auto-created (gitignored) — see Uploads below
prisma/
  schema.prisma      Document, User models + Role/FileCategory enums
  seed.ts             sample documents + dev accounts (student/teacher/admin)
src/
  auth.ts              Auth.js config: Credentials provider, JWT callbacks
  app/
    layout.tsx        fonts, header, footer
    page.tsx           homepage: hero search, subjects, popular documents
    search/page.tsx    results page, reads ?q= and ?subject=
    documents/[id]/    document detail page (renders FilePreview) + not-found state
    login/page.tsx      email/password login (server action)
    register/page.tsx   registration — always creates STUDENT
    profile/page.tsx     requires auth; shows name/email/role
    upload/page.tsx       TEACHER/ADMIN only; file upload form (server action)
    error.tsx           friendly fallback if the API/DB is unreachable
    api/
      documents/route.ts        GET (list + ?search=), POST
      documents/[id]/route.ts   GET, PUT, DELETE
      documents/upload/route.ts  POST — TEACHER/ADMIN only, multipart file upload
      documents/[id]/preview/route.ts  GET — public, streams the file inline (see Preview below)
      subjects/route.ts         GET distinct subjects with counts
      auth/[...nextauth]/route.ts  Auth.js handlers (session, sign-in/out)
      auth/register/route.ts       POST — always creates STUDENT
  components/
    ui/                Button, Input, Badge, Card primitives
    SearchBar.tsx       client component, pushes /search?q=...
    DocumentCard.tsx    title, subject, type, academic year, description
    SubjectCard.tsx     subject + live document count
    SiteHeader.tsx      logo, nav, session-aware login/profile/logout/upload
    FilePreview.tsx      PDF/image/video/docx preview, unsupported/unavailable placeholders
    DocxPreview.tsx       client-only .docx renderer (docx-preview), loading/error states
    docx-preview-render.ts  fetch + render orchestration used by DocxPreview (unit-testable)
  lib/
    prisma.ts           Prisma client singleton
    api-client.ts        server-side fetch helpers used by the pages
    api-response.ts      { success, data, error, meta } response envelope
    validation/document.ts  zod schemas for create/update
    validation/auth.ts       zod schemas for register/login
    subjects.ts           cosmetic accent-colour helper (no document data)
    auth/
      password.ts        bcrypt hash/verify
      authenticate.ts     Credentials provider authorize() logic
      session.ts          jwt/session callback logic
      register.ts          registerStudent() — role always STUDENT
      authorize.ts         requireAuth(), requireRole(), hasRole()
    documents/
      upload.ts            uploadDocument() — validate, store, create Document
      upload-config.ts       MAX_UPLOAD_SIZE_MB / MAX_UPLOAD_SIZE_BYTES (central config)
      preview-range.ts       pure `Range: bytes=` header parser for video seeking
      preview-kind.ts         resolvePreviewKind() — single source of truth for what's previewable
    storage/
      local-storage.ts       format/category rules, safe keys, fs read/write/delete,
                              plus statLocalFile/createLocalFileReadStream for preview
```

## API

| Method | Path                  | Description                          |
| ------ | --------------------- | ------------------------------------- |
| GET    | `/api/documents`      | List documents. `?search=`, `?subject=`, `?take=`, `?skip=` |
| GET    | `/api/documents/:id`  | Get one document                      |
| POST   | `/api/documents`      | Create a document                     |
| PUT    | `/api/documents/:id`  | Update a document                     |
| DELETE | `/api/documents/:id`  | Delete a document                     |
| GET    | `/api/subjects`       | Distinct subjects with document counts |
| POST   | `/api/auth/register`  | Register a new account. Always creates role `STUDENT` |
| *      | `/api/auth/[...nextauth]` | Auth.js sign-in/sign-out/session endpoints |
| POST   | `/api/documents/upload` | Upload a file + metadata. TEACHER/ADMIN only, multipart form data |
| GET    | `/api/documents/:id/preview` | Streams the file inline for preview. Public — no auth. See [Preview](#preview) |

All responses use `{ success, data, error }` (plus `meta` for list pagination),
except `/api/documents/:id/preview`, which streams the raw file body on success
(errors still use the standard envelope).
Search matches `title`, `description`, and `subject` (case-insensitive).

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
- Development seed accounts (created by `npm run db:seed`):

  | Email | Password | Role |
  | --- | --- | --- |
  | student@example.com | student123 | STUDENT |
  | teacher@example.com | teacher123 | TEACHER |
  | admin@example.com | admin123 | ADMIN |

- Requires an `AUTH_SECRET` env var — see `.env.example` for how to generate one.

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
  is fine for a single-instance/local setup, but does **not** survive
  redeploys on most serverless/ephemeral-filesystem hosts and won't be shared
  across multiple app instances — swapping in a real storage backend later
  only requires changing `src/lib/storage/local-storage.ts`, since nothing
  else in the app talks to the filesystem directly.

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
  attachment`, so supported types render inline. The Download button on the
  document page stays disabled — a real download feature is a later step.
