# Prompt Studio

The right fields in. One agent-ready brief out.

Write a goal or an issue, the checks that prove it, what to leave alone, and the context an agent needs. Prompt Studio turns them into a validated JSON brief you can paste into a coding agent. Saved briefs live in your account, backed by MongoDB Atlas, or stay in the browser when you are signed out. A portable Windows build runs the same editor offline with local history and no account.

![The editor in light mode](docs/screenshots/desktop-light.png)

![The editor in dark mode](docs/screenshots/desktop-dark-filled.png)

![The create account dialog](docs/screenshots/desktop-auth.png)

## What it does

- Prose fields use a rich editor: bold, italic, inline code, bullet and numbered lists, quotes, headings, undo, and redo. Typing `- `, `1. `, `# `, or `> ` starts the matching block.
- List fields use a compact line editor. One item per line. Paste a list and it splits, trims, and dedupes; file paths also split on commas and semicolons.
- Field cards collapse. Goal or Issue starts open, optional fields start closed with a one-line summary, and the Brief check opens the field it points to. Expand all and Collapse all are one click away.
- A work-type toggle switches between feature and bug. The first field becomes Issue in bug mode, and the payload key becomes `issue`.
- Feature mode shows Goal, Done when, Details, Out of scope, Constraints, File references, How to verify, and Open questions. Bug mode shows seven fields with bug labels: Issue, Repro and context, Fixed when, Do not change, Suspect files, How to confirm, and Open questions.
- A Brief check panel grades the brief from Thin to Strong. It checks the goal, the done-when list, the verification list, the out-of-scope list, and whether details or files give the agent context. It sits in the Agent brief panel, above Save and Copy. Click a missing check to expand and focus its field.
- Directive chips append their sentence to the payload. They are grouped as Process and Guardrails: plan first, read first, ask first, test first, prove it, smallest diff, no new deps, fix the root cause, and keep it maintainable.
- The right panel updates on every keystroke with the JSON brief. Copy it or download `brief.json`.
- Clear one field with the eraser in its card. The toast offers Undo, and Ctrl+Z also restores it. The header Reset clears all fields, the work type, and the autosaved draft.
- The JSON Schema tab shows the draft 2020-12 schema the payload is validated against. Zod generates both from one declaration.
- Create an account to save briefs to MongoDB Atlas. History is scoped to the account and follows you to any device.
- Signed-out use still works. Drafts and guest history stay in this browser.
- History exports to `prompt-studio-history.json` and imports on another machine. Import merges by content, keeps the newest copy, and caps at 50.
- A Tauri desktop build ships as one portable `.exe`. It runs offline, keeps history on the device, and never calls the server.
- A server status pill shows `Server online`, `Waking server`, `Database offline`, or `Server offline`. Signed-in saves make one immediate attempt plus four retries when Render's free instance is waking.
- Light, dark, and system themes. The choice survives a reload.

## Run it

```sh
npm install
cp .env.example .env
# set MONGODB_URI in .env to your Atlas connection string
npm run dev
```

`npm run dev` starts the Vite app on http://localhost:5173 and the API on http://localhost:8787. Vite proxies `/api` so cookies stay same-origin. The dev runner refuses to start when either port is taken, restarts the API when it stops listening for 10 seconds, and stops both processes on Ctrl+C.

To run the production build locally:

```sh
npm run build
npm start
```

Open http://localhost:8787. Express serves the built SPA and the API from one origin.

```sh
npm test          # 108 unit tests
npm run typecheck
npm run lint
npm run build
```

## Desktop app (Windows)

The desktop build is the same editor with the server and account paths removed. It runs offline, keeps the draft and history in WebView2 local storage, and ships as one portable executable.

```sh
npm run build:desktop    # offline web shell in dist-desktop
npm run verify:desktop   # build and run 14 offline browser checks
npm run desktop:dev      # native Tauri window (needs Rust and a WebView)
npm run desktop:build    # src-tauri/target/release/prompt-studio.exe
```

The `desktop` GitHub Actions workflow runs the checks on Linux and builds the exe on `windows-latest`. Download the `prompt-studio-windows` artifact.

To run the native shell locally on Linux, install the Tauri prerequisites first (`libwebkit2gtk-4.1-dev`, `libxdo-dev`, and `librsvg2-dev`). The Windows exe is built on Windows; cross-compiling it from Linux is not supported.

Requirements and caveats:

- Windows 10 or 11 with the WebView2 runtime. It ships with Windows 11 and current Windows 10. Older images need the Evergreen runtime.
- The exe is unsigned. SmartScreen shows a warning on first launch. Choose **More info**, then **Run anyway**, or sign the exe before distributing it.
- The exe is portable, but its data is not. WebView2 stores history under `%LOCALAPPDATA%\com.promptstudio.app`. Use **History**, then **Export** and **Import**, to move briefs between machines.
- Expect roughly 5-10 MB for the exe. WebView2 is shared with Windows, so it is not bundled. If the artifact includes a DLL beside the exe, keep both files together.
- The desktop build does not include Express, MongoDB, accounts, or syncing.

## Accounts and storage

| Where | What | Key |
| --- | --- | --- |
| MongoDB Atlas | Users, sessions, saved briefs | `prompt_studio` database |
| Browser localStorage | Draft, guest history, theme | `prompt-studio.*` keys |
| WebView2 local storage (desktop) | Draft, local history, theme | `prompt-studio.*` keys |

Signed in, Save writes `POST /api/history` and the drawer reads the account. Signed out, Save and the drawer use localStorage. Signing in does not upload existing guest entries.

The desktop build always runs as a guest. It has no sign-in path and never calls the API.

Passwords use Node's scrypt with a random salt. Sessions are random tokens stored as SHA-256 hashes in Mongo, sent in an httpOnly `ps_session` cookie for 30 days. Logout deletes the session. Every history query filters by `userId`.

### API

| Method | Path | Auth | Result |
| --- | --- | --- | --- |
| GET | `/api/ping` | no | Liveness for Render |
| GET | `/api/health` | no | Server uptime and Mongo state |
| POST | `/api/auth/signup` | no | Create an account and session |
| POST | `/api/auth/login` | no | Sign in |
| POST | `/api/auth/logout` | no | Revoke the session |
| GET | `/api/auth/me` | no | Current user or `null` |
| GET | `/api/history` | yes | Newest 50 saved briefs |
| POST | `/api/history` | yes | Save one, or report a duplicate |
| DELETE | `/api/history/:id` | yes | Delete one owned brief |
| DELETE | `/api/history` | yes | Clear the account's history |

Validation, auth, and rate-limit failures return `{ "error", "code" }`.

## Cold start

Render's free web service sleeps after idle time. The first request can take 30 to 60 seconds while the instance boots. The app handles that in three places.

1. The status pill probes `/api/health` on load and shows `Waking server` while the probe hangs or fails once.
2. A signed-in save retries network errors and 502, 503, and 504 responses. It makes one immediate attempt, then retries at 0, 1.5, 4, and 8 seconds. Each attempt aborts after 65 seconds, and the toast says `Server is waking up. Retrying save.`
3. The drawer's list request uses the same retry policy, so history appears once the instance is awake.

The server starts its HTTP listener before Mongo connects. Routes that need the database return 503 until it is ready, and `/api/health` reports `connecting` or `error`. The server retries the Atlas connection every 5 seconds.

## Deploy to Render

`render.yaml` defines one free web service.

1. Push the repo to GitHub.
2. In Render, create a Blueprint from the repo.
3. Set `MONGODB_URI` to the Atlas connection string with the real password, and `APP_ORIGIN` to the Render URL, for example `https://prompt-studio.onrender.com`.
4. In Atlas, allow Render to connect. The simple option is a network access rule for `0.0.0.0/0`. The tighter option is the Render egress IPs for your region.
5. Deploy. Render builds with `npm ci --include=dev && npm run build` and starts `node dist-server/server/index.js`.

The build compiles the server to CommonJS in `dist-server`, writes a matching `package.json`, and bundles the SPA into `dist`. Express serves both.

## The payload

```json
{
  "schemaVersion": "3.0",
  "kind": "feature",
  "goal": "**Ship a settings page** with a theme toggle.",
  "details": "Dark mode persists across reloads.",
  "acceptanceCriteria": [
    "Choosing dark survives a reload",
    "System mode follows the OS setting"
  ],
  "nonGoals": [
    "Do not change the auth flow",
    "Do not add a theme editor"
  ],
  "constraints": "- Stay client-only\n- No new dependencies",
  "fileReferences": ["src/state/useTheme.ts", "src/App.tsx"],
  "verification": [
    "npm test",
    "npm run typecheck",
    "Toggle dark, reload, confirm the page stays dark"
  ],
  "openQuestions": [
    "Should the toggle follow the OS?",
    "Which icon set should ship?"
  ],
  "directives": ["Create a plan only. Do not edit the codebase until the user approves the plan."]
}
```

| Field | Payload key | Shape |
| --- | --- | --- |
| Goal / Issue | `goal`, or `issue` in bug mode | Markdown string, required |
| Done when / Fixed when | `acceptanceCriteria` | String array, one testable check per item |
| Details | `details` | Markdown string. Bug mode asks for repro steps, expected versus actual, environment, and logs |
| Out of scope / Do not change | `nonGoals` | String array, one boundary per item |
| Constraints | `constraints` | Markdown string. Shown in feature mode |
| File references / Suspect files | `fileReferences` | String array, one path per item, deduplicated |
| How to verify / How to confirm | `verification` | String array, one command or manual check per item |
| Open questions | `openQuestions` | String array, one question per item |

The `kind` field makes the payload a discriminated union: `feature` requires `goal`, `bug` requires `issue`. Feature mode shows all eight fields. Bug mode shows seven and omits Constraints from the form; the payload still carries `constraints` as an empty string so the shape stays stable. Selected directives land as full sentences in `directives`.

Prose fields keep inline formatting as Markdown. List fields flatten each top-level block and nested list item into one string. File paths lose wrapping backticks, quotes, list markers, and trailing punctuation before deduplication.

## How the data moves

```text
FieldEditor / ListFieldEditor.onChange [1] ← one control per active field
├── useBriefDraft.setField [1a] ← replace one snapshot entry
│   ├── draft snapshot { docs, settings } [1a1]
│   │   ├── debounce 300 ms → localStorage draft [1a1a]
│   │   └── compileBrief(docs, settings) [1a1b] ← memoized per snapshot
│   │       ├── docToMarkdown(goal or issue, details, constraints) [1a1b1]
│   │       ├── docToItems(done, nonGoals, verify) [1a1b2]
│   │       ├── docToItems(files).map(normalizePath) [1a1b3]
│   │       ├── dedupe file paths [1a1b4]
│   │       ├── directiveTexts(settings.directives) [1a1b5]
│   │       ├── BriefSchema.safeParse(candidate) [1a1b6] ← zod contract
│   │       └── JSON.stringify(value, null, 2) [1a1b7]
│   └── replace(docs, settings) on history load [1a2] ← remounts editors
├── OutputPanel [1b]
│   ├── BriefCheck [1b1] ← briefCheck(docs, settings) over the active field set
│   ├── Save brief [1b2] → useHistory.save [1b2a]
│   │   ├── signed out → localStorage [1b2a1]
│   │   └── signed in → POST /api/history with wake retry [1b2a2]
│   ├── Copy JSON [1b3] ← disabled until valid
│   └── Download brief.json [1b4]
├── HistoryDrawer [1c]
│   ├── account source → GET /api/history [1c1]
│   ├── browser source → localStorage [1c2]
│   └── export and import history JSON [1c3]
└── useAuth [1d] ← GET /api/auth/me, signup, login, logout
```

`shared/brief-docs.ts` validates documents and derives titles for both the browser and the server. `shared/api.ts` holds the wire types.

## Project layout

```text
server/             Express app, Mongo access, auth, history, tests
shared/             document validation, title derivation, wire types
src-tauri/          Tauri 2 shell, config, icons
src/
├── brief/          contract, field sets, registry, list helpers, markdown, compiler, check, tests
├── history/        pure entry model, merge, relative time, tests
├── editor/         TipTap field, compact list field, toolbar, action table
├── state/          auth, server status, history, draft, and theme hooks
├── lib/api.ts      fetch wrapper, typed routes, wake retry
├── lib/platform.ts desktop build flag
├── ui/             form, brief check, output, history, auth, account, status, theme
├── App.tsx         header, grid, dialogs, toasts
└── styles.css      design tokens and editor typography
scripts/verify-desktop.cjs  offline desktop browser checks
```

## Design

Colors and spacing live in `src/styles.css` as CSS variables mapped into Tailwind v4 through `@theme inline`. The `dark` class on `<html>` swaps the token set. A small script in `public/theme.js` applies the stored theme before first paint.

The layout is a two-column workspace at 1024 px and wider, and a single column below that. Every action button uses the same hover, pressed, focus, and disabled recipe. Enabled controls show a pointer, disabled controls show not-allowed, and reduced motion removes the transitions. The toolbar exposes `aria-pressed`, the output tabs follow the WAI-ARIA tabs pattern, and the auth dialog and history drawer share one focus-trap hook.

`src/brief/`, `src/history/`, and `shared/` import neither React nor the DOM, so they can move into a workspace package without edits.

## Stitch MCP

The original visual layer was built without Stitch because no Stitch MCP server or API key was configured in this environment. `docs/stitch.md` has the setup commands, the OpenCode config, and the prompt to regenerate the screen. The account dialog adds one more surface to that prompt.

## Verification

- `npm test` runs 108 unit tests across the serializer, schema, brief check, field sets, list helpers, directives, history model, password hashing, rate limiting, origin checks, and document validation.
- `npm run verify:api` runs 33 checks against a real local mongod: signup, sessions, save, duplicate detection, settings validation, two-user isolation, IDOR, delete, clear, logout, bad credentials, and origin rejection.
- `npm run verify:ui` runs 99 guest checks in Chrome, including pointer and disabled cursors, per-field clear, Undo, Ctrl+Z, mode-specific field sets, the brief check, its position before Copy, collapsed cards, compact list fields, directive groups, and reduced motion.
- `npm run verify:auth` runs 25 account checks: signup, account save, sign-out, second-account isolation, history restore across reload, degraded and recovered status, retry after two simulated 503s, and screenshots.
- `npm run verify:desktop` runs 14 offline desktop checks: no API requests, no account or server UI, local draft and history, history export and import, copy, download, and the schema tab. It starts its own preview server.
- Run the server first for `verify:ui` and `verify:auth`. `verify:desktop` is self-contained.
