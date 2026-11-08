# Prompt history implementation spec

## Goal

Add explicit save, persistent storage, and a viewable list of saved briefs to Prompt Studio. A saved brief must restore the exact editable draft, not just the exported JSON.

## Constraint: monorepo

Keep every new pure module importable without React, the DOM, or app code:

- `src/brief/docs.ts` imports only TipTap's `JSONContent` type and the registry's `FieldId` type.
- `src/history/entry.ts` imports only `src/brief/docs.ts` and `src/brief/markdown.ts`.
- `src/state/useHistory.ts` and `src/ui/HistoryDrawer.tsx` may import React, but no pure module may import them.

That boundary lets `brief/` and `history/` move into a package unchanged.

## Data shape

A history entry stores the four ProseMirror documents. The JSON brief is derived on demand, so the saved brief and the restored draft cannot disagree.

```ts
export interface HistoryEntry {
  id: string
  savedAt: number // epoch ms
  docs: FieldDocs
}
```

Storage key: `prompt-studio.history.v1`. Value:

```json
{ "version": 1, "entries": [{ "id": "...", "savedAt": 1770000000000, "docs": {} }] }
```

Cap at 50 entries, newest first. Drop the oldest.

## New and moved modules

### `src/brief/docs.ts`

Move these out of `src/state/useBriefDraft.ts`, unchanged in behavior:

- `EMPTY_PARAGRAPH`, `EMPTY_DOCS`
- the allowed node and mark sets
- `isJsonContent(value)`
- `readDoc(value)`
- `docsKey(docs): string` which returns `JSON.stringify(docs)`

`useBriefDraft` imports them. Do not duplicate the validator.

### `src/history/entry.ts`

Pure functions, no DOM:

```ts
export const HISTORY_KEY = 'prompt-studio.history.v1'
export const HISTORY_LIMIT = 50

export interface HistoryEntry { id: string; savedAt: number; docs: FieldDocs }

export function parseHistory(raw: string | null): HistoryEntry[]
export function serializeHistory(entries: HistoryEntry[]): string
export function addEntry(
  entries: HistoryEntry[],
  entry: HistoryEntry,
  limit?: number,
): HistoryEntry[]
export function isNewestDuplicate(entries: HistoryEntry[], docs: FieldDocs): boolean
export function historyTitle(docs: FieldDocs): string
export function relativeTime(savedAt: number, now?: number): string
export function fieldCount(docs: FieldDocs): number
```

- `parseHistory` accepts null or invalid JSON and returns `[]`. It drops individual invalid entries instead of failing the whole list, sorts newest first, and applies the cap.
- `serializeHistory` returns `JSON.stringify({ version: 1, entries })`.
- `addEntry` returns the same array reference when the newest entry has an identical `docsKey`. Otherwise it prepends and slices.
- `historyTitle` takes the first line of `docToMarkdown(docs.goal)`, strips leading heading hashes and list markers, removes `*`, `_`, and backticks, trims, and truncates to 72 characters with an ellipsis. Empty becomes `Untitled brief`.
- `relativeTime` buckets: under 45 seconds `just now`; under 60 minutes `N min ago`; under 24 hours `N hr ago`; under 7 days `N days ago`; otherwise a short date such as `Mar 4`.
- `fieldCount` counts fields whose text is non-empty, 0 to 4.

### `src/state/useHistory.ts`

```ts
export type SaveOutcome = 'saved' | 'duplicate' | 'error'

export function useHistory(): {
  entries: HistoryEntry[]
  save(docs: FieldDocs): SaveOutcome
  remove(id: string): void
  clear(): void
  error: string | null
}
```

- Lazy `useState` reads and parses the key.
- Write to localStorage before updating state. On quota or access failure, set `error` to `History is full. Delete an entry and try again.` and leave state unchanged.
- `save` returns `duplicate` without writing when `isNewestDuplicate` is true.
- Subscribe to the `storage` event for this key and reload entries, so two tabs converge.
- `remove` and `clear` persist first, then update state.

### `src/state/useBriefDraft.ts`

Add:

```ts
replace(docs: FieldDocs): void
```

It sets the docs, increments `resetToken` so the uncontrolled editors remount, and lets the existing autosave effect write the restored draft.

## UI

### Save

`src/ui/OutputPanel.tsx` gains an `onSave(): void` prop. Above the copy/download row, add a full-width primary button labelled `Save brief` with a bookmark icon. Disable it with the same `!compiled.ok` rule and reason as copy and download.

### History button

In `src/App.tsx`, add a header button between the completion meter and the theme control:

- icon plus the text `History`
- a count chip showing `entries.length`
- text hidden below `xl`, icon and count always visible
- `aria-haspopup="dialog"`, `aria-expanded`, and an accessible name that includes the count

### Drawer

`src/ui/HistoryDrawer.tsx`:

- fixed overlay, backdrop `bg-black/40 backdrop-blur-sm`, panel on the right, full height, `w-full sm:max-w-md`
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- focus the close button on open, trap Tab within the dialog, close on Escape and on backdrop click, lock body scroll while open
- header: `History`, entry count, `Clear all` when entries exist, close button
- empty state: `No saved briefs yet.` plus `Save a brief to keep a snapshot you can reload.`
- each row: title, `Saved <relative time>`, field count, and two actions, `Load` and a trash icon button with `aria-label={'Delete "' + title + '"'}`. Use `time` with `dateTime`.
- footer: `Saved in this browser.`
- error line when `error` is set

Loading asks `window.confirm('Replace the current draft with this saved brief?')`. Deleting asks `window.confirm('Delete "' + title + '" from history?')`. Clearing asks `window.confirm('Delete all saved briefs? This cannot be undone.')`.

After load, close the drawer, restore focus to the History button, and show the toast `Saved brief loaded.` Save outcomes map to `Saved to history.`, `This brief is already the newest save.`, and the error text.

Add a slide-in keyframe and a backdrop fade to `src/styles.css`. The global reduced-motion rule already neutralizes animation.

## Tests

`src/history/entry.test.ts`:

1. `historyTitle` strips heading and list markers and truncates past 72 characters.
2. `historyTitle` returns `Untitled brief` for an empty goal.
3. `relativeTime` covers all five buckets with a fixed `now`.
4. `parseHistory` returns `[]` for null and bad JSON, drops invalid entries, sorts newest first, and caps at 50.
5. `addEntry` prepends, caps, and returns the same reference on a newest duplicate.
6. `fieldCount` counts non-empty fields.

`src/brief/docs.test.ts` if useful, at minimum `docsKey` is stable across equal documents.

Keep the existing 9 tests passing.

## Browser verification

Extend `scripts/verify-ui.cjs` after the existing payload checks:

1. Click `Save brief`, assert the toast says saved, and assert the History button count is 1.
2. Open History, assert the row title matches the goal's plain text.
3. Save again, assert the toast says already saved and the count stays 1.
4. Change the goal, open History, click `Load`, accept the confirm, assert the goal reverted and the JSON matches the saved payload.
5. Reload, assert the History count is still 1.
6. Open History, delete the entry, accept the confirm, assert the empty state.
7. Screenshot the drawer in light and dark at 1440 px, and once at 390 px.

Run `npm test`, `npm run typecheck`, `npm run build`, then the browser script against the production preview.

## Rules

- No narrating comments.
- No `any`, no non-null assertions.
- The draft key and the history key stay separate. No shared writer.
- History writes are synchronous and happen before state updates.
- Do not change the brief payload schema or the JSON Schema tab.
- Do not add dependencies.
