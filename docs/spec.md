# Prompt Studio implementation spec

## Product

A client-only web app. The user writes four rich-text fields and the app emits one JSON brief for a coding agent. Name: Prompt Studio. Tagline: "Four fields in. One agent-ready brief out."

Fields, in order:

| id | label | payload key | payload kind | required |
| --- | --- | --- | --- | --- |
| goal | Goal | goal | markdown string | yes |
| constraints | Constraints | constraints | markdown string | no |
| files | File references | fileReferences | string[] | no |
| questions | Open questions | openQuestions | string[] | no |

Each field is a TipTap editor with a toolbar and markdown input shortcuts (`- ` bullet, `1. ` ordered, `# ` heading, `> ` quote). File references are one path per line or bullet. Open questions are one question per line or bullet.

## Stack and constraints

Vite 8, React 19, TypeScript strict, Tailwind CSS v4 (already wired through `@tailwindcss/vite`), TipTap 3, zod 4, lucide-react. No backend, no router, no state library, no extra dependency. Everything runs in the browser. Drafts stay in localStorage.

## Contract

`src/brief/schema.ts`:

```ts
export const BRIEF_SCHEMA_VERSION = '1.0' as const

export const BriefSchema = z
  .object({
    schemaVersion: z.literal(BRIEF_SCHEMA_VERSION),
    goal: z.string().min(1, 'Add a goal before exporting.'),
    constraints: z.string(),
    fileReferences: z.array(z.string().min(1)),
    openQuestions: z.array(z.string().min(1)),
  })
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

`src/brief/registry.ts` holds `FIELD_REGISTRY` for UI only (label, hint, placeholder, icon, kind, required, toolbar ids, badge). Payload keys live in one exported map:

```ts
export const PAYLOAD_KEY = {
  goal: 'goal',
  constraints: 'constraints',
  files: 'fileReferences',
  questions: 'openQuestions',
} as const
```

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

export function compileBrief(docs: FieldDocs): Compiled
```

It derives each value from the docs, parses with `BriefSchema.safeParse`, and always returns `json` (the payload when valid, the candidate when not). Issue paths map back to field ids through a reverse `PAYLOAD_KEY` lookup. The JSON preview always shows `json`; the status badge reads valid or incomplete.

## State and persistence

`src/state/useBriefDraft.ts`

```ts
export const EMPTY_DOCS: FieldDocs
export function useBriefDraft(): {
  docs: FieldDocs
  setField(id: FieldId, doc: JSONContent): void
  reset(): void
  resetToken: number
  started: number
}
```

- Lazy `useState` initializer reads `prompt-studio.draft.v1`. Parse defensively inside try/catch and a zod object of four `z.unknown()` records; a bad or unknown record falls back to that field's empty doc.
- Debounced 300 ms write of `{ version: 1, docs }` to `prompt-studio.draft.v1`. Flush on `pagehide`.
- `reset()` clears the key, resets docs, increments `resetToken`, which remounts the editors.
- `started` counts fields whose compiled text is non-empty.

`src/state/useTheme.ts`

```ts
export type ThemePreference = 'light' | 'dark' | 'system'
export function useTheme(): {
  preference: ThemePreference
  resolved: 'light' | 'dark'
  setPreference(p: ThemePreference): void
}
```

- Persist the preference alone under `prompt-studio.theme.v1` (plain string, matches the inline script in `index.html`).
- `resolved` derives from `preference` plus `matchMedia('(prefers-color-scheme: dark)')` through `useSyncExternalStore`, so "system" tracks the OS live.
- One effect toggles the `dark` class and `colorScheme` on `document.documentElement`.
- Unknown stored values fall back to `system`.

These are two keys, not one. Do not merge them; that would make two hooks write the same record.

## Editor

`src/editor/FieldEditor.tsx` renders one field from a `FieldSpec`:

- `useEditor` with `immediatelyRender: false`, `content: doc`, `editorProps.attributes` for `aria-label`, `aria-describedby`, role textbox, spellcheck.
- `StarterKit.configure` disables codeBlock, horizontalRule, strike, and link. Add `Placeholder` with the spec's placeholder, and `ListKeymap` if StarterKit does not include it.
- `onUpdate` calls `onChange(editor.getJSON())`. The editor is uncontrolled after mount; a `resetToken` prop remounts it.
- Toolbar uses `ToolbarAction` ids from the registry: bold, italic, code, bulletList, orderedList, blockquote, undo, redo. Render lucide icons with tooltips in `title` and `aria-label`, `aria-pressed` from `editor.isActive(...)`, disabled undo/redo when unavailable. Subscribe to editor state with `useEditorState` so pressed states repaint.
- Markdown shortcuts come from StarterKit input rules. Show a hint in the field footer.

`src/editor/Toolbar.tsx` owns the button row and the `actions.ts` table (id, label, shortcut, icon, command).

## App shell

`src/App.tsx` composes:

- Sticky header: brand mark (rounded square, `{}` glyph, accent), name, tagline, completion meter (4 segments plus "n of 4 started"), theme segmented control (light / dark / system), reset button with confirmation via `window.confirm`.
- Main grid: `lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]`, gap 24px, max width 1400px, padding 24px.
- Left: four `FieldEditor` cards from `FIELD_REGISTRY`, numbered 01 to 04.
- Right: sticky output panel, `top-24`, max height `calc(100vh - 7rem)`, flex column.
- Footer line: "Stored in this browser. Nothing is sent anywhere." plus a link-less note that the brief is meant to be pasted into an agent.

`src/ui/OutputPanel.tsx`:

- Header row: "Agent brief", status pill.
- Tabs: "Brief JSON" and "JSON Schema" with `role="tablist"`, arrow-key roving focus, `aria-selected`, `aria-controls`.
- Code area: `pre` with `font-mono text-[12.5px] leading-relaxed`, `bg-code`, border, rounded, scroll, `max-h-[52vh]`.
- Actions: "Copy JSON" and "Download brief.json". Copy uses `navigator.clipboard.writeText` with a textarea fallback and shows a toast. Download builds a Blob URL and revokes it.
- Both actions are disabled with an explanation when `!compiled.ok`. Download filename is `brief.json`.
- When the goal is empty, show a calm empty hint above the code: "Add a goal to export this brief."

`src/ui/BriefForm.tsx` maps the registry and renders a section per field. `src/ui/ThemeToggle.tsx` is the segmented control. `src/ui/Icon.tsx` maps icon names to lucide components.

## Visual direction

Tokens already exist in `src/styles.css`. Use them, do not invent colors.

- Canvas: `bg-canvas`, page wrapper adds `app-backdrop` and `min-h-dvh`.
- Cards: `field-shell` class plus padding 20-24px.
- Text: `text-ink`, `text-muted`, `text-subtle`.
- Accent: `text-accent`, `bg-accent`, `bg-accent-soft`, `border-accent-line`. Primary button is `bg-accent text-on-accent`.
- Status: valid uses `bg-ok-soft text-ok border-ok-line`; incomplete uses `bg-warn-soft text-warn border-warn-line`.
- Radius: cards 16px, buttons 10px, inputs 12px.
- Type scale: page title 15px semibold; field label 15px semibold; hint 12.5px muted; body 14px; code 12.5px mono.
- Numbers `01` to `04` in a mono badge with accent-soft background.
- Toolbar buttons 28x28, rounded 8px, hover `bg-surface-3`, active `bg-accent-soft text-accent`.
- Motion: 160ms color transitions only. Respect reduced motion (already global).

Follow the structure of `docs/design-a.md` and `docs/design-b.md` where they agree with this spec. This spec wins on conflicts.

## Accessibility

- Real labels tied to editors through `aria-labelledby` or `aria-label`.
- Required field marked with `aria-required` and a visible "Required" chip.
- Field errors use `aria-describedby` and live in an `aria-live="polite"` region.
- Toolbar buttons expose `aria-pressed` and `aria-keyshortcuts`.
- Tabs follow the WAI-ARIA tabs pattern.
- Toast is `role="status"` and self-dismisses after 2.5s.
- Visible focus ring comes from the global `:focus-visible` rule. Do not remove it.

## Tests

`src/brief/*.test.ts` with vitest, importing only pure modules:

1. `briefJsonSchema` has `$schema`, `AgentBrief`, and a `goal` key with a minLength of 1.
2. A valid sample brief parses; an empty goal fails with a `goal` path.
3. `docToMarkdown` covers bold, italic, code, heading, bullet list, ordered list, blockquote, and hard break.
4. `docToItems` flattens nested bullets in order and drops empty paragraphs.
5. `normalizePath` strips backticks, quotes, trailing commas, and dedupes.
6. `compileBrief` returns `ok: true` with a goal and maps an empty goal issue to `field: 'goal'`.

Add `"test": "vitest run"` and `"typecheck": "tsc -b"` to package.json scripts.

## Rules

- No narrating comments. A comment only states a non-obvious why.
- No `any`, no non-null assertions. Parse external storage at the boundary.
- Keep the keystroke path short: editor update, set state, memoized compile, render. No effects for derivation.
- Empty docs must produce stable identities so the compile memo does not churn.
- Mobile: single column below 1024px; the output panel is normal flow and full width under the form.
- Do not add a markdown parser, form library, syntax highlighter, or router.
- Run `npm run build` and `npm test` before reporting done.
