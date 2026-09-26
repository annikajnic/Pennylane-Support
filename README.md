# PennyLane Support Platform

A community-driven support conversations platform for PennyLane quantum coding challenges.

- **client/**: React + TypeScript (Vite)
- **server/**: Express + TypeScript, SQLite via Prisma

## Setup

Requires Node 20+.

```bash
# Server
cd server
npm install
cp .env.example .env
npx prisma migrate dev   # creates the SQLite DB and runs the seed
npm run dev              # http://localhost:3001

# Client (in a second terminal)
cd client
npm install
npm run dev              # http://localhost:5173
```

The client proxies `/api/*` to the server, so no extra configuration is needed.

To re-seed from scratch: `cd server && npm run db:reset`.

## Data

The seed script (`server/prisma/seed.ts`) loads `pennylane_coding_challenges.json` and
`pennylane_support_conversations.json` from the repo root. It coerces numeric fields
(the source data has at least one challenge with `points` as a string) and fails loudly
on any value that isn't a valid number or date.

## Design decisions

_To be filled in as the build progresses._
