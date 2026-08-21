# Stacks — school document library (step 1)

Homepage → search → search results, backed by a real PostgreSQL database
through a Prisma-powered REST API. No auth, upload, PDF preview, or AI yet.

## Stack

- Next.js (App Router) + React + Tailwind CSS + shadcn-style UI primitives
- Next.js Route Handlers for the API
- PostgreSQL + Prisma ORM

## Run it

1. Start a local Postgres (either works):

   ```bash
   docker compose up -d
   ```

   or point `DATABASE_URL` in `.env` at any Postgres instance you already have running.

2. Install dependencies, run the migration, and seed sample data:

   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   ```

3. Start the app:

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
  schema.prisma      Document model
  seed.ts             sample documents for development
src/
  app/
    layout.tsx        fonts, header, footer
    page.tsx           homepage: hero search, subjects, popular documents
    search/page.tsx    results page, reads ?q= and ?subject=
    error.tsx           friendly fallback if the API/DB is unreachable
    api/
      documents/route.ts        GET (list + ?search=), POST
      documents/[id]/route.ts   GET, PUT, DELETE
      subjects/route.ts         GET distinct subjects with counts
  components/
    ui/                Button, Input, Badge, Card primitives
    SearchBar.tsx       client component, pushes /search?q=...
    DocumentCard.tsx    title, subject, type, academic year, description
    SubjectCard.tsx     subject + live document count
    SiteHeader.tsx      logo area
  lib/
    prisma.ts           Prisma client singleton
    api-client.ts        server-side fetch helpers used by the pages
    api-response.ts      { success, data, error, meta } response envelope
    validation/document.ts  zod schemas for create/update
    subjects.ts           cosmetic accent-colour helper (no document data)
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

All responses use `{ success, data, error }` (plus `meta` for list pagination).
Search matches `title`, `description`, and `subject` (case-insensitive).
