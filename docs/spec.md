# Prompt Studio implementation spec

## Product

A web app with an optional offline desktop build. The user fills a mode-specific set of brief fields and the app emits one JSON brief for a coding agent. Name: Prompt Studio. Tagline: "The right fields in. One agent-ready brief out."

Feature mode shows eight fields. Bug mode shows seven.

| id | feature label | bug label | payload key | payload kind | required |
| --- | --- | --- | --- | --- | --- |
| goal | Goal | Issue | `goal`, or `issue` in bug mode | markdown string | yes |
| done | Done when | Fixed when | `acceptanceCriteria` | string[] | no |
| details | Details | Repro and context | `details` | markdown string | no |
| nonGoals | Out of scope | Do not change | `nonGoals` | string[] | no |
| constraints | Constraints | hidden | `constraints` | markdown string | no |
| files | File references | Suspect files | `fileReferences` | string[] | no |
| verify | How to verify | How to confirm | `verification` | string[] | no |
| questions | Open questions | Open questions | `openQuestions` | string[] | no |

Feature order: `goal`, `done`, `details`, `nonGoals`, `constraints`, `files`, `verify`, `questions`. Bug order: `goal`, `details`, `done`, `nonGoals`, `files`, `verify`, `questions`. `FIELD_SETS` in `shared/brief-docs.ts` owns the order.

Prose fields use a TipTap editor with a toolbar and markdown input shortcuts (`- ` bullet, `1. ` ordered, `# ` heading, `> ` quote). List fields use a compact line editor: one item per line, and a pasted list is split, trimmed, and deduped. File references also split on commas and semicolons.

## Stack and constraints

Vite 8, React 19, TypeScript strict, Tailwind CSS v4 (already wired through `@tailwindcss/vite`), TipTap 3, zod 4, lucide-react. The web app ships with an Express and MongoDB history service. The desktop build removes the server paths and runs offline. No router, no state library, no extra UI dependency. Drafts stay in localStorage.

## Contract

`src/brief/schema.ts`:

```ts
export const BRIEF_SCHEMA_VERSION = '3.0' as const

const SHARED_FIELDS = {
  details: z.string(),
  acceptanceCriteria: z.array(z.string().min(1)),
  nonGoals: z.array(z.string().min(1)),
  constraints: z.string(),
  fileReferences: z.array(z.string().min(1)),
  verification: z.array(z.string().min(1)),
  openQuestions: z.array(z.string().min(1)),
  directives: z.array(z.string().min(1)),
}

export const FeatureBriefSchema = z
  .object({
    schemaVersion: z.literal(BRIEF_SCHEMA_VERSION),
    kind: z.literal('feature'),
    goal: z.string().min(1, 'Add a goal before exporting.'),
    ...SHARED_FIELDS,
  })
  .meta({ id: 'FeatureBrief', title: 'Feature brief' })

export const BugBriefSchema = z
  .object({
    schemaVersion: z.literal(BRIEF_SCHEMA_VERSION),
    kind: z.literal('bug'),
    issue: z.string().min(1, 'Describe the issue before exporting.'),
    ...SHARED_FIELDS,
  })
  .meta({ id: 'BugBrief', title: 'Bug brief' })

export const BriefSchema = z
  .discriminatedUnion('kind', [FeatureBriefSchema, BugBriefSchema])
  .meta({
    id: 'AgentBrief',
    title: 'Agent brief',
    description: 'A structured brief for a coding agent.',
  })

export type Brief = z.infer<typeof BriefSchema>
export const briefJsonSchema = z.toJSONSchema(BriefSchema, {
  target: 'draft-2020-12',
  io: 'output',
})
```

Do not hand-write a second schema. The Schema tab renders `briefJsonSchema`.

`src/brief/registry.ts` holds `FIELD_REGISTRY`, the superset of field specs (label, hint, placeholder, icon, kind, required, toolbar ids, bug labels). `FIELD_SETS` in `shared/brief-docs.ts` owns the order per work type. `fieldSet(kind)` returns the active specs; `fieldSpec(id)` looks one up. Payload keys live in one exported map:

```ts
export const PAYLOAD_KEY = {
  goal: 'goal',
  done: 'acceptanceCriteria',
  details: 'details',
  nonGoals: 'nonGoals',
  constraints: 'constraints',
  files: 'fileReferences',
  verify: 'verification',
  questions: 'openQuestions',
} as const
```

Bug mode maps `goal` to `issue`. Every other key is shared.

`src/brief/markdown.ts` is a write-only serializer over the closed extension set. No markdown parser anywhere.

```ts
export function docToMarkdown(doc: JSONContent): string
export function docToItems(doc: JSONContent): string[]
export function normalizePath(value: string): string
```

Supported nodes: doc, paragraph, heading (1-3), text, hardBreak, bulletList, orderedList, listItem, blockquote. Supported marks: bold, italic, code.

- Inline marks: `**bold**`, `_italic_`, `` `code` ``. A code span containing a backtick uses a double-backtick fence.
- Blocks join with `\n\n`; the result is trimmed.
- Lists use `- ` and `1. ` with two-space nesting indent.
- Blockquote prefixes each line with `> `.
- `docToItems` walks top-level blocks: every list item and every top-level paragraph becomes one entry, nested list items flatten in document order. Entries are inline markdown, trimmed, empty entries dropped.
- `normalizePath` trims, strips a leading list marker, strips wrapping backticks or quotes, strips a trailing comma or semicolon, collapses inner whitespace. Empty results are dropped. Duplicates drop, first occurrence wins.

`src/brief/compile.ts`:

```ts
export type FieldDocs = Record<FieldId, JSONContent>
export interface FieldIssue { field: FieldId | null; message: string }

export type Compiled =
  | { ok: true; payload: Brief; json: string; issues: [] }
  | { ok: false; candidate: unknown; json: string; issues: FieldIssue[] }

export function compileBrief(docs: FieldDocs, settings: BriefSettings): Compiled
```

It derives each value from the docs, parses with `BriefSchema.safeParse`, and always returns `json` (the payload when valid, the candidate when not). `acceptanceCriteria`, `nonGoals`, and `verification` come from `docToItems` on `done`, `nonGoals`, and `verify`. Issue paths map back to field ids through a reverse `PAYLOAD_KEY` lookup. The JSON preview always shows `json`; the status badge reads valid or incomplete.

## Directives

`src/brief/directives.ts` holds `DIRECTIVE_REGISTRY` and `DIRECTIVE_GROUPS`. `DIRECTIVE_IDS` in `shared/brief-docs.ts` is the source of truth for the allowed ids.

- Process: `plan`, `read-first`, `ask-first`, `test-first`, `prove-it`.
- Guardrails: `smallest-diff`, `no-new-deps`, `root-cause`, `maintainable`.
- Every text is at most `MAX_DIRECTIVE_LENGTH` (160) characters. The registry test enforces order, uniqueness, groups, and length.
- `directiveTexts` filters the registry by the selected ids, so payload order follows registry order.

The directives card renders one chip row per group. Selected chips use the soft variant and `aria-pressed`.

## Presets and suggestions

`src/brief/presets.ts` holds `PRESETS` and `applyPresetToDocs`. Five presets: Small bugfix, Feature slice, Refactor, Spike, Review. Each sets the work type and directives, and fills only empty fields in the preset kind's active field set. `applyPresetToDocs` returns the next docs, settings, and the filled field ids. `useBriefDraft.applyPreset` applies the result, increments `resetToken` so prose editors remount, and returns the previous snapshot for the toast Undo.

`src/ui/PresetBar.tsx` renders the Start from row at the top of the work type card. The copy says "Fills empty fields only." Applying a preset shows a toast with Undo.

`src/brief/suggestions.ts` holds `suggestionFor(field, kind)`. Unmet Brief checks render a Suggest button beside the focus button. Suggest calls `BriefFormHandle.suggestField`, which expands the field and calls `FieldControl.insert` with a starter item. The user edits the inserted text. No AI, no automatic submission.

## Keyboard

`src/state/useShortcuts.ts` owns the global keydown listener. Shortcuts are disabled while the command palette, shortcut help, auth dialog, or history drawer is open.

- `Ctrl/Cmd+K` toggles the command palette.
- `Ctrl/Cmd+S` saves.
- `Ctrl/Cmd+Alt+C` copies the JSON. `Ctrl+Shift+C` is avoided because Chrome uses it for DevTools.
- `Alt+Down` and `Alt+Up` move to the next or previous active field.
- `?` opens the shortcut help when focus is not in an editor or input.

`src/ui/CommandPalette.tsx` uses `filterCommands` from `src/lib/commands.ts` and the combobox/listbox pattern. It lists fields, presets, mode, layout, copy, save, history, and help. `src/ui/ShortcutsDialog.tsx` lists the bindings. Both use `useDialog` for focus trap, Escape, and backdrop close.

`BriefFormHandle.moveField` reads the focused card's `data-field-id` and focuses the next or previous id in the active field set.

## State and persistence

`src/state/useBriefDraft.ts`

```ts
export const EMPTY_DOCS: FieldDocs
export function useBriefDraft(): {
  docs: FieldDocs
  settings: BriefSettings
  setField(id: FieldId, doc: JSONContent): void
  setKind(kind: WorkKind): void
  toggleDirective(id: DirectiveId): void
  replace(docs: FieldDocs, settings: BriefSettings): void
  applyPreset(preset: BriefPreset): { docs: FieldDocs; settings: BriefSettings }
  reset(): void
  resetToken: number
}
```

- Lazy `useState` initializer reads `prompt-studio.draft.v2`, then falls back to `prompt-studio.draft.v1`. Parse defensively with `parseFieldDocs`; a bad record falls back to empty docs.
- Debounced 300 ms write of `{ version: 2, docs, settings }` to `prompt-studio.draft.v2`. Flush on `pagehide`.
- Missing optional documents (`details`, `done`, `nonGoals`, `verify`) are filled with empty docs, so v1 and v2 drafts load.
- `reset()` clears the key, resets docs, increments `resetToken`, which remounts the editors.

`src/state/useTheme.ts`

```ts
export type ThemePreference = 'light' | 'dark' | 'system'
export function useTheme(): {
  preference: ThemePreference
  resolved: 'light' | 'dark'
  setPreference(p: ThemePreference): void
}
```

- Persist the preference alone under `prompt-studio.theme.v1` (plain string, matches the script in `public/theme.js`).
- `resolved` derives from `preference` plus `matchMedia('(prefers-color-scheme: dark)')` through `useSyncExternalStore`, so "system" tracks the OS live.
- One effect toggles the `dark` class and `colorScheme` on `document.documentElement`.
- Unknown stored values fall back to `system`.

These are two keys, not one. Do not merge them; that would make two hooks write the same record.

## Desktop build

`vite --mode desktop` sets `IS_DESKTOP` in `src/lib/platform.ts`. Desktop mode is chosen at build time, not by runtime detection.

- `useAuth` starts at `ready` with no user and makes no `/api/auth/me` request.
- `useServerStatus` starts at `offline` and makes no `/api/health` request.
- `App` hides the server status pill, account menu, and auth dialog. The footer says the brief is stored on the device.
- `useHistory` reads and writes localStorage, as in guest mode.
- `npm run build:desktop` writes `dist-desktop` with a relative base. `dist` and the server build are unchanged.
- `src-tauri/` wraps `dist-desktop` in a Tauri 2 window. `tauri build --no-bundle` produces the portable exe. The CSP allows self, inline styles, blobs, and Tauri IPC only.
- The desktop build is offline-only. It does not bundle Express or MongoDB, and it does not ship account sync.

History export uses `serializeHistory`, so the file is the existing `{ "version": 2, "entries": [...] }` shape. Import parses with `parseHistory`, merges with `mergeHistory`, dedupes by id and by brief content, keeps the newest copy, sorts newest first, and caps at 50. Export and import are available only for browser history; account history is not imported.

`npm run verify:desktop` builds `dist-desktop`, serves it with Vite preview, and checks that the offline app makes no `/api` requests, hides account and server UI, persists the draft and history, exports and imports history, copies and downloads the brief, and renders the schema tab.

## Editor

`src/editor/FieldEditor.tsx` renders a prose field from a `FieldSpec`:

- `useEditor` with `immediatelyRender: false`, `content: doc`, `editorProps.attributes` for `aria-label`, `aria-describedby`, role textbox, spellcheck.
- `StarterKit.configure` disables codeBlock, horizontalRule, strike, and link. Add `Placeholder` with the spec's placeholder, and `ListKeymap` if StarterKit does not include it.
- `onUpdate` calls `onChange(editor.getJSON())`. The editor is uncontrolled after mount; a `resetToken` prop remounts it.
- Toolbar uses `ToolbarAction` ids from the registry: bold, italic, code, bulletList, orderedList, blockquote, undo, redo. Render lucide icons with tooltips in `title` and `aria-label`, `aria-pressed` from `editor.isActive(...)`, disabled undo/redo when unavailable. Subscribe to editor state with `useEditorState` so pressed states repaint.
- Markdown shortcuts come from StarterKit input rules. Show a hint in the field footer.

`src/editor/Toolbar.tsx` owns the button row and the `actions.ts` table (id, label, shortcut, icon, command).

`src/editor/ListFieldEditor.tsx` renders an `items` field as a compact textarea. One item per line. Paste splits on newlines (and commas or semicolons for files), trims, drops empties, and dedupes. It stores the same `DocNode` shape as one paragraph per line, so the compiler, schema, history, and export do not change. It exposes a `FieldControl` with `focus`, `clear`, `undo`, `isEmpty`, and `insert`; `FieldEditor` exposes the same interface.

`src/editor/control.ts` defines `FieldControl`. `BriefForm` stores one control per field id for the eraser toast and the Brief check focus.

## App shell

`src/App.tsx` composes:

- Sticky header: brand mark (rounded square, `{}` glyph, accent), name, tagline, theme segmented control (light / dark / system), reset button with confirmation via `window.confirm`.
- Main grid: `lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]`, gap 24px, max width 1400px, padding 24px.
- Left: the work type card with the Start from preset row, grouped directive chips (Process and Guardrails), then a Fields row with Expand all and Collapse all, then collapsible field cards for `fieldSet(settings.kind)`. Goal or Issue starts expanded; optional fields start collapsed with a one-line summary. The Brief check opens the field it points to. Prose fields use `FieldEditor`; list fields use `ListFieldEditor`. Numbers are the field's position in the active set (01 to 08 in feature mode, 01 to 07 in bug mode).
- Right: sticky Agent brief panel with the JSON and Schema tabs, the inline Brief check, Save, Copy, and Download.
- Overlays: command palette and shortcut help at `z-50`, plus the existing auth dialog and history drawer. All use the shared dialog hook.
- Footer line: "Stored in this browser. Nothing is sent anywhere." plus a link-less note that the brief is meant to be pasted into an agent.

`src/ui/BriefCheck.tsx` renders `briefCheck(docs, settings)` from `src/brief/check.ts`. It sits inside the Agent brief panel above Save and Copy; the inline variant uses a top divider instead of a card shell. Five checks: goal, done-when, verification, out-of-scope, and context (details or files). Statuses are `Thin brief`, `Good start`, and `Strong brief`. Missing checks are buttons that expand and focus their field, plus a Suggest action that inserts a starter item. The panel is not a second source of truth; it derives from the docs on every render.

`src/ui/OutputPanel.tsx`:

- Header row: "Agent brief", status pill.
- Tabs: "Brief JSON" and "JSON Schema" with `role="tablist"`, arrow-key roving focus, `aria-selected`, `aria-controls`.
- Code area: `pre` with `font-mono text-[12.5px] leading-relaxed`, `bg-code`, border, rounded, scroll, `max-h-[40vh]`.
- Inline Brief check between the code area and the actions. Missing checks expand and focus their field through the `BriefFormHandle`; Suggest inserts a starter through the same handle.
- Actions: "Copy JSON" and "Download brief.json". Copy uses `navigator.clipboard.writeText` with a textarea fallback and shows a toast. Download builds a Blob URL and revokes it.
- Both actions are disabled with an explanation when `!compiled.ok`. Download filename is `brief.json`.
- When the required field is empty, show a calm hint above the code: "Add a goal to export this brief." or "Describe the issue to export this brief."

`src/ui/BriefForm.tsx` maps `fieldSet(settings.kind)` and renders a section per field. The card body is hidden when collapsed; the header keeps the badge, label, hint or summary, eraser, icon, and chevron, with `aria-expanded` and `aria-controls`. It exposes `focusField`, `suggestField`, `expandAll`, `collapseAll`, and `moveField` through a `BriefFormHandle` ref; `App` passes them to `OutputPanel`, the preset flow, and the shortcut handler. `src/ui/ThemeToggle.tsx` is the segmented control. `src/ui/Icon.tsx` maps icon names to lucide components.

## Visual direction

Tokens already exist in `src/styles.css`. Use them, do not invent colors.

- Canvas: `bg-canvas`, page wrapper adds `app-backdrop` and `min-h-dvh`.
- Cards: `field-shell` class plus padding 20-24px.
- Text: `text-ink`, `text-muted`, `text-subtle`.
- Accent: `text-accent`, `bg-accent`, `bg-accent-soft`, `border-accent-line`. Primary button is `bg-accent text-on-accent`.
- Status: valid uses `bg-ok-soft text-ok border-ok-line`; incomplete uses `bg-warn-soft text-warn border-warn-line`.
- Radius: cards 16px, buttons 10px, inputs 12px.
- Type scale: page title 15px semibold; field label 15px semibold; hint 12.5px muted; body 14px; code 12.5px mono.
- Numbers are the field's position in the active set: `01` to `08` in feature mode, `01` to `07` in bug mode. Use a mono badge with accent-soft background.
- List fields use the same card shell without a formatting toolbar. The textarea is borderless, uses the body type scale, has a 5.5rem minimum height, and is vertically resizable.
- Toolbar buttons 28x28, rounded 8px, hover `bg-surface-3`, active `bg-accent-soft text-accent`.
- Motion: 160ms color transitions only. Respect reduced motion (already global).

Follow the structure of `docs/design-a.md` and `docs/design-b.md` where they agree with this spec. This spec wins on conflicts.

## Accessibility

- Real labels tied to editors through `aria-labelledby` or `aria-label`.
- Required field marked with `aria-required` and a visible "Required" chip.
- Field errors use `aria-describedby` and live in an `aria-live="polite"` region.
- Toolbar buttons expose `aria-pressed` and `aria-keyshortcuts`.
- The Brief check panel names the missing field in each unmet check. Unmet checks expose a focus button and a Suggest button with an accessible label.
- Tabs follow the WAI-ARIA tabs pattern.
- Toast is `role="status"` and self-dismisses after 2.5s.
- Visible focus ring comes from the global `:focus-visible` rule. Do not remove it.

## Tests

`src/brief/*.test.ts` with vitest, importing only pure modules:

1. `briefJsonSchema` has `$schema`, `AgentBrief`, `acceptanceCriteria`, `nonGoals`, and `verification`, and a `goal` key with a minLength of 1.
2. A valid sample brief parses; an empty goal fails with a `goal` path.
3. `docToMarkdown` covers bold, italic, code, heading, bullet list, ordered list, blockquote, and hard break.
4. `docToItems` flattens nested bullets in order and drops empty paragraphs.
5. `normalizePath` strips backticks, quotes, trailing commas, and dedupes.
6. `compileBrief` returns `ok: true` with a goal and maps an empty goal issue to `field: 'goal'`. It lands `acceptanceCriteria`, `nonGoals`, and `verification` as lists.
7. `briefCheck` reports thin, good, and strong; accepts files as context; and uses bug labels.
8. `FIELD_SETS` order matches the registry, and `parseFieldDocs` fills optional documents for v1 and v2 records.
9. `fieldSet(kind)` returns the shared field-set order, and every field id has a spec.
10. `mergeHistory` dedupes by id and content, keeps the newest copy, sorts, and caps at 50.
11. The directive registry matches `DIRECTIVE_IDS` order, has unique ids/labels/texts, populates both groups, and keeps every text at or under 160 characters.
12. `listLinesFromDoc` and `listDocFromLines` preserve line order and empty lines, flatten nested lists, and `splitPastedList` splits, trims, and dedupes.
13. `applyPresetToDocs` fills only empty active fields, sets the preset kind and directives, and leaves the goal untouched. `suggestionFor` returns kind-specific starters for the checked fields.
14. `filterCommands` matches labels, hints, and keywords, ignores case, returns every command for an empty query, and returns an empty list when nothing matches.

## Rules

- No narrating comments. A comment only states a non-obvious why.
- No `any`, no non-null assertions. Parse external storage at the boundary.
- Keep the keystroke path short: editor update, set state, memoized compile, render. No effects for derivation.
- Empty docs must produce stable identities so the compile memo does not churn.
- Mobile: single column below 1024px; the output panel is normal flow and full width under the form.
- Do not add a markdown parser, form library, syntax highlighter, or router.
- Run `npm run build` and `npm test` before reporting done.
