# Stacks — school document library (step 1)

Homepage → search → search results → document detail, backed by a real
PostgreSQL database through a Prisma-powered REST API. Authentication
(email/password via Auth.js) with STUDENT/TEACHER/ADMIN roles is implemented.
No file upload, PDF preview, real download, or AI yet.

## Stack

- Next.js (App Router) + React + Tailwind CSS + shadcn-style UI primitives
- Next.js Route Handlers for the API
- PostgreSQL + Prisma ORM
- Auth.js (Credentials provider, JWT sessions)

## Run it

1. Start a local Postgres (either works):

   ```bash
   docker compose up -d
   ```

   or point `DATABASE_URL` in `.env` at any Postgres instance you already have running.

2. Set an `AUTH_SECRET` in `.env` (see `.env.example`):

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

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
prisma/
  schema.prisma      Document, User models + Role enum (STUDENT/TEACHER/ADMIN)
  seed.ts             sample documents + dev accounts (student/teacher/admin)
src/
  auth.ts              Auth.js config: Credentials provider, JWT callbacks
  app/
    layout.tsx        fonts, header, footer
    page.tsx           homepage: hero search, subjects, popular documents
    search/page.tsx    results page, reads ?q= and ?subject=
    documents/[id]/    document detail page + not-found state
    login/page.tsx      email/password login (server action)
    register/page.tsx   registration — always creates STUDENT
    profile/page.tsx     requires auth; shows name/email/role
    error.tsx           friendly fallback if the API/DB is unreachable
    api/
      documents/route.ts        GET (list + ?search=), POST
      documents/[id]/route.ts   GET, PUT, DELETE
      subjects/route.ts         GET distinct subjects with counts
      auth/[...nextauth]/route.ts  Auth.js handlers (session, sign-in/out)
      auth/register/route.ts       POST — always creates STUDENT
  components/
    ui/                Button, Input, Badge, Card primitives
    SearchBar.tsx       client component, pushes /search?q=...
    DocumentCard.tsx    title, subject, type, academic year, description
    SubjectCard.tsx     subject + live document count
    SiteHeader.tsx      logo, nav, session-aware login/profile/logout
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

All responses use `{ success, data, error }` (plus `meta` for list pagination).
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
