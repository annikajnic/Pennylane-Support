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

### Roles instead of logins
I decided not to build logins for learner and support users. Instead, a toggle in the nav bar switches between the two views, so a reviewer can easily see how they differ. The server enforces every role rule, so hiding things in the UI is not the only protection: the client sends the selected role in an `X-Role` header, and a missing or unknown value is treated as a learner, making the restricted view the default. For a production app, real authentication would be an important next step for security and the integrity of the application.

### Separate challenge and conversation pages
Challenges and conversations live on separate pages so the challenge pages stay focused on the challenge itself. Learners usually attempt a challenge first and then look for support, so support has its own space. The two are linked in both directions: a challenge page links to its conversations and has an "Ask a question" button, and each conversation links back to its challenge.

### Learner vs support access
Learners have more limited access than support. They can browse published challenges, read conversations, start new conversations, and reply, unless a conversation is locked. Draft and archived challenges are hidden from learners, and requesting one returns a 404, so hidden challenges aren't revealed to them. The same applies to conversations about unpublished challenges, because showing them would reveal those challenges' titles. Support users see everything and can triage conversations: assign them, change status and priority, and pin or lock them.

### Insights
The Insights page is for support users only. It shows whether questions are being answered (open vs resolved), which challenges generate the most questions, how work is spread across the team, and the average resolution time. Each chart links to the matching filtered conversation list, so support can quickly act on unanswered questions.

### UX design
I used PennyLane's brand colours and fonts so the app feels cohesive with PennyLane's existing products and familiar to people learning PennyLane.

### Scalability
Some decisions, and some things I left out of scope, are worth mentioning.

- **Backend:** Tags are stored as JSON text for now (see "Data model" below). As the platform grows, I'd move them into their own table so they can be managed, standardised, and searched more efficiently.
- **Authentication:** As mentioned above, I left out logins because of time constraints and to make the app easier to review.
- **Testing:** With more time, I would add automated tests for the API routes so changes don't break core behaviour as the app grows.

### Data model
There are three tables: Challenge, Conversation, and Post. Each conversation belongs to a challenge and each post belongs to a conversation. I kept the original IDs from the JSON (`CHAL_001`, `CONV_0001`) so the URLs match the source data, and new conversations follow the same format.

Tags, hints, learning objectives, and prerequisites are stored as JSON text instead of separate tables. SQLite doesn't support arrays, these lists are always loaded with their challenge, and the data set is small, so a join table felt like extra complexity for now. The downside is tag filtering can't use an index, which is why I'd move tags to their own table later.

I didn't store `participants` or `participant_count` from the JSON since that information already exists in the posts, and keeping both would let them get out of sync. Participants are worked out from the posts instead. I checked in the seed script that the counts matched the original data for all 800 conversations.

Resolution time is only set when a conversation is resolved or closed, and it's cleared if the conversation gets reopened, so the average on the Insights page stays accurate.
