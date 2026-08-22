#!/usr/bin/env bash
# First-run / day-to-day launcher for the Stacks school document library.
# Safe to re-run: it only writes .env if missing and only seeds if the DB is empty.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "==> Installing dependencies"
  npm install
fi

if [ ! -f .env ]; then
  echo "==> Creating .env from .env.example"
  cp .env.example .env
  SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
  if [[ "$OSTYPE" == darwin* ]]; then
    sed -i '' "s#AUTH_SECRET=.*#AUTH_SECRET=\"$SECRET\"#" .env
  else
    sed -i "s#AUTH_SECRET=.*#AUTH_SECRET=\"$SECRET\"#" .env
  fi
fi

echo "==> Applying database migrations"
if ! npx prisma migrate deploy; then
  if command -v docker >/dev/null 2>&1; then
    echo "==> Database unreachable, starting Postgres via Docker"
    docker compose up -d
    for i in $(seq 1 30); do
      if npx prisma migrate deploy; then
        break
      fi
      sleep 1
    done
  else
    echo "Could not reach the database and Docker is not installed." >&2
    echo "Start Postgres manually (matching DATABASE_URL in .env) and re-run this script." >&2
    exit 1
  fi
fi

USER_COUNT="$(node -e 'const {PrismaClient}=require("@prisma/client");new PrismaClient().user.count().then(c=>{console.log(c);process.exit(0)}).catch(()=>{console.log(-1);process.exit(0)});')"

if [ "$USER_COUNT" = "0" ]; then
  echo "==> No data found, seeding sample documents and dev accounts"
  npm run db:seed
fi

echo "==> Starting dev server (http://localhost:3000)"
npm run dev
