# Accounts and server history spec

## Shape

One Node service on Render serves the built SPA and the API from the same origin. MongoDB Atlas stores users, sessions, and briefs. Sessions live in Mongo and travel in an httpOnly cookie, so logout revokes access immediately and no JWT signing key is needed.

```
browser
├── React app            src/
│   ├── lib/api.ts       fetch wrapper + wake retries
│   ├── state/useAuth.ts
│   ├── state/useServerStatus.ts
│   └── state/useHistory.ts  local when signed out, server when signed in
└── /api/*  ──► Express on Render ──► MongoDB Atlas
```

`shared/brief-docs.ts` is the single document validator and title deriver for both sides. `shared/api.ts` holds the wire types. Server code imports both with relative paths.

## Environment

`.env` (gitignored) and `.env.example`:

```
PORT=8787
MONGODB_URI=mongodb+srv://.../?retryWrites=true&w=majority
MONGODB_DB=prompt_studio
SESSION_TTL_DAYS=30
APP_ORIGIN=http://localhost:5173
```

`server/config.ts` loads `dotenv/config` and reads the variables. `APP_ORIGIN` is the browser origin allowed to send unsafe requests. In production, fall back to `RENDER_EXTERNAL_URL`. In development, allow any `http://localhost:*` and `http://127.0.0.1:*` origin.

`render.yaml` is already written. Do not change its commands.

## API

JSON only. Errors use `{ "error": string, "code"?: string }`.

| Method | Path | Auth | Success | Notes |
| --- | --- | --- | --- | --- |
| GET | `/api/ping` | no | 200 `{ ok: true }` | Render health check |
| GET | `/api/health` | no | 200 `{ ok, db, uptime }` | `ok` is `db === "connected"` |
| POST | `/api/auth/signup` | no | 201 `{ user }` | Sets cookie |
| POST | `/api/auth/login` | no | 200 `{ user }` | Sets cookie |
| POST | `/api/auth/logout` | no | 204 | Clears cookie, deletes session |
| GET | `/api/auth/me` | no | 200 `{ user: User \| null }` | Never 401 |
| GET | `/api/history` | yes | 200 `{ entries }` | Newest first, max 50 |
| POST | `/api/history` | yes | 200 `{ entry, duplicate }` | Validates docs, trims to 50 |
| DELETE | `/api/history/:id` | yes | 204 | 404 when not owned |
| DELETE | `/api/history` | yes | 204 | Clears only the caller's entries |

`User` is `{ id, email }`. `HistoryEntry` is `{ id, savedAt, docs }`. `docs` is `FieldDocs` from `shared/brief-docs.ts`.

Status codes:

- 400 `invalid_input`, `invalid_docs`
- 403 `forbidden_origin`
- 413 `payload_too_large`
- 401 `auth_required`, `invalid_credentials`
- 404 `not_found`
- 409 `email_taken`
- 429 `rate_limited`
- 503 `db_unavailable`

`/api/health` always answers 200 while the process is alive. The client reads `db` and maps it.

## Auth

- Normalize email to lowercase and trim. Max 254 chars. Validate with a simple `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
- Password length 8 to 200.
- Hash with `node:crypto` scrypt. Store `s1$<saltBase64url>$<hashBase64url>`, 16-byte salt, 64-byte key. Verify with `timingSafeEqual`.
- Session token: 32 random bytes base64url. Store only `sha256(token)` as the session `_id`.
- Cookie `ps_session`: `httpOnly`, `sameSite: 'lax'`, `secure` when production, `path: '/'`, `maxAge` from the TTL.
- Session document `{ _id: tokenHash, userId, createdAt, expiresAt }` with a TTL index on `expiresAt`.
- `requireUser` middleware reads the cookie, hashes it, loads the session, loads the user, and attaches `req.user`. 401 on any failure or expiry.
- Generic login error. Never log passwords, tokens, or hashes.
- Rate limit auth endpoints: 10 requests per IP per 15 minutes. In-memory is fine. Set `trust proxy` so `req.ip` is the client on Render.
- Reject unsafe requests (`POST`, `DELETE`) when the `Origin` header is present and not allowed.

## Data

Indexes created at startup, idempotently:

- `users.email` unique
- `sessions.expiresAt` TTL, `expireAfterSeconds: 0`
- `briefs`: `{ userId: 1, savedAt: -1 }`

Documents:

```
users    { _id: ObjectId, email, passwordHash, createdAt }
sessions { _id: string, userId: ObjectId, createdAt, expiresAt }
briefs   { _id: ObjectId, userId: ObjectId, title, savedAt, docs, createdAt }
```

Every brief query includes `userId`. Trim after insert by reading ids after the 50th newest and deleting them.

Save behavior:

1. Parse and validate `docs` with `parseFieldDocs`.
2. Reject when `JSON.stringify(docs).length` exceeds 64 KiB.
3. Load the newest brief for the user. If `docsKey(newest.docs) === docsKey(docs)`, return it with `duplicate: true` and write nothing.
4. Insert with `savedAt: Date.now()` and `title: historyTitle(docs)`.
5. Delete entries past 50.

## Startup and cold start

- Connect to Mongo with `serverSelectionTimeoutMS: 8000` in a background loop. Retry every 5 seconds after failure. The HTTP server starts even when Mongo is down so Render does not crash-loop.
- Routes that need the database return 503 `db_unavailable` when it is not connected.
- Close the Mongo client on `SIGTERM` and `SIGINT`.
- Serve `dist/` with `express.static` and an SPA fallback for non-`/api` GET requests in production. Keep `/api` 404s JSON.
- Security headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `X-Frame-Options: DENY`.
- `express.json({ limit: '256kb' })`.

## Client

### API client, `src/lib/api.ts`

- `credentials: 'include'` on every call.
- Errors carry `status` and the parsed `code`.
- `withWakeRetry` makes one immediate attempt plus up to four retries at 0, 1500, 4000, and 8000 ms. It retries network errors, 502, 503, and 504. Abort each attempt after 65 seconds. Call an `onRetry` callback so the UI can show the waking state.
- Typed wrappers for the routes above.

### Auth, `src/state/useAuth.ts`

- On mount call `me()`. `user: null` means signed out.
- `signup`, `login`, `logout` set `busy` and `error`.
- Expose `{ status: 'loading' | 'ready', user, busy, error, signup, login, logout, clearError }`.

### Server status, `src/state/useServerStatus.ts`

- States: `checking`, `online`, `degraded`, `waking`, `offline`.
- `online` when health returns `db === 'connected'`. `degraded` when the server answers with another db state.
- `waking` while a health request hangs or fails once. `offline` after two consecutive failures.
- Poll every 30 seconds when online, every 10 seconds otherwise. Skip the poll while the document is hidden and recheck on `visibilitychange`.
- `check()` is manual and used by the status pill.
- Expose `reportWake()` so a save failure can flip the pill immediately.

### History, `src/state/useHistory.ts`

- Signed out keeps the current localStorage behavior and reports `source: 'browser'`.
- Signed in loads from the server and reports `source: 'account'`. Save, remove, and clear call the API through `withWakeRetry`.
- Expose `{ entries, source, loading, saving, error, save, remove, clear }`.
- `save` returns `'saved' | 'duplicate' | 'error'`.
- On a failed save, keep the draft untouched and let the user press Save again.
- Do not migrate local entries on sign-in. Show a note in the drawer instead.
- When the user changes, reload the matching source. Guard against out-of-order responses with a request id.

### UI

- `ServerStatusPill`: button with a status dot and label. `online` uses the ok tokens, `degraded` and `waking` use the warn tokens, `offline` uses warn with a stronger border, `checking` uses muted. Clicking calls `check()`. Label text: `Server online`, `Database offline`, `Waking server`, `Server offline`, `Checking server`. On narrow screens show only the dot with the full label in `aria-label`.
- `AccountMenu`: signed out shows `Sign in`. Signed in shows the email in a menu with `Sign out`. Escape and click outside close it.
- `AuthDialog`: modal with `Sign in` and `Create account` tabs, email and password fields, inline error, busy submit. Same accessibility as the history drawer: `role="dialog"`, `aria-modal`, focus on open, Tab trap, Escape, backdrop click, body scroll lock, focus return. Extract a `useDialog` hook and use it in both the drawer and the dialog.
- Header order: brand, completion meter (hide below `lg`), status pill, account, History, theme, Reset.
- `OutputPanel`: Save shows `Saving...` and is disabled while `saving` or invalid. Copy and download still work from the local compile.
- `HistoryDrawer`: subtitle reads `Saved to your account` or `Saved in this browser`. When signed out, a quiet banner offers `Sign in to sync history across devices.` When loading, show a small skeleton or `Loading history...`. Keep the existing row anatomy, empty state, confirms, and focus behavior.
- Toast mapping: saved, duplicate, wake retry, error, sign-in success, sign-out.

## Tests

Server unit tests with vitest:

1. `hashPassword` and `verifyPassword` round trip, wrong password fails, malformed hash fails.
2. Session token hash is stable and tokens differ.
3. Rate limiter allows up to the limit then blocks until the window resets.
4. Origin check allows the configured origin and rejects another in production.
5. `shared/brief-docs.ts` rejects invalid docs, derives titles, and keys docs.

The API and browser proof run outside vitest against a local mongod:

- `scripts/verify-api.mjs` covers signup, me, save, duplicate save, list, isolation between two users, delete, clear, logout, and bad credentials.
- `scripts/verify-auth.cjs` drives the UI: sign up, save to account, sign out, second account sees an empty history, first account sees its entry again, retry after simulated 503s, delete, and screenshots.

## Rules

- No narrating comments, no `any`, no non-null assertions.
- Never log secrets.
- Every brief and session query scopes the owner.
- Keep `shared/` free of Node and React imports.
- Do not add dependencies beyond `express`, `mongodb`, `dotenv`, `tsx`, and the Express types.
