# Prompt Studio: four fields as one document

## Problem

Prompt Studio composes one JSON brief for a coding agent out of four rich-text fields, with a live JSON preview, a JSON Schema tab, autosave, and three theme choices — all client-only. The non-obvious part is where the document lives. Four editors, two array-shaped payload fields, a live preview, a schema viewer, and persistence tempt a registry that generates both form and schema, or a form library wrapped around TipTap. At four fields that machinery costs more than it hides and lengthens the keystroke path. Fixed constraints: TipTap v3 owns live ProseMirror state, zod v4 with `z.toJSONSchema` owns the contract, no backend, localStorage only. This design treats the four fields as one small document: one snapshot of four ProseMirror docs, one pure function from snapshot to payload JSON.

## Usage (caller's view)

```tsx
import { briefJsonSchema } from './brief/schema';   // the Schema tab renders this object

const { drafts, setField, compiled } = useComposer();
const { choice, resolved, setChoice } = useTheme(); // one choice value, not two booleans

return FIELDS.map((spec) => (
  <FieldEditor
    key={spec.id} spec={spec} doc={drafts[spec.id]}
    onChange={(doc) => setField(spec.id, doc)}
  />
));
// compiled.text feeds the preview, the clipboard, and brief.json — one serialization
// compiled.ok gates copy/download; compiled.issues render beside their field
```

## Shape

**Types.** `FIELDS` is the single ordered list of fields and carries editor affordances only, never payload shape.

```ts
const FIELDS = [
  { id: 'goal',        label: 'Goal',            shape: 'prose', toolbar: ['bold', 'italic'] },
  { id: 'constraints', label: 'Constraints',     shape: 'prose', toolbar: ['bold', 'italic', 'bullet'] },
  { id: 'files',       label: 'File references', shape: 'paths', toolbar: ['code', 'bullet'] },
  { id: 'questions',   label: 'Open questions',  shape: 'items', toolbar: ['bullet'] },
] as const;
type FieldId = (typeof FIELDS)[number]['id'];
type Doc = JSONContent;                              // ProseMirror JSON, hidden inside src/editor
type FieldDrafts = Record<FieldId, Doc>;
```

**Contract.** One zod object in `brief/schema.ts`; everything else derives from it.

```ts
const BriefSchema = z.object({
  schemaVersion: z.literal(1),
  goal: z.string().min(1),
  constraints: z.string(),
  fileReferences: z.array(z.string().min(1)),
  openQuestions: z.array(z.string().min(1)),
}).meta({ id: 'Brief', title: 'Prompt Studio brief' });
type Brief = z.infer<typeof BriefSchema>;
const briefJsonSchema = z.toJSONSchema(BriefSchema, { target: 'draft-2020-12' });
```

**One deep call.** `compileBrief` derives, validates, and serializes; callers see none of the stages.

```ts
type Issue = { field: FieldId | null; message: string };
type Compiled = { value: Brief; text: string; ok: boolean; issues: Issue[] };
function compileBrief(drafts: FieldDrafts): Compiled;
```

Inside it, four explicit lines assemble the value, so the compiler forces every payload key and the id→key mapping (`files` → `fileReferences`) exists in exactly one place. `BriefSchema.safeParse(value)` supplies `ok` and `issues`; `text` is `JSON.stringify(value, null, 2)` and is the only JSON string in the app.

**Markdown between editor and payload.** `brief/markdown.ts` owns the field text format.

```ts
function docToMarkdown(doc: Doc): string;        // closed schema: paragraph, bold, italic, code, bullet list
function listItems(markdown: string): string[];  // bullet and ordered-list lines, trimmed
function pathItems(markdown: string): string[];  // listItems → strip backticks → dedupe, order kept
```

`src/editor/extensions.ts` declares the closed extension set next to the serializer's switch, so toolbar capability and serialization capability cannot drift. Serialization is write-only: autosave stores ProseMirror JSON, so no markdown parser and no round-trip fidelity problem exists. `fileReferences` is `pathItems(docToMarkdown(drafts.files))`; `openQuestions` is `listItems(...)`; goal and constraints pass markdown through as strings.

**State and flow.** TipTap owns each live doc; React owns one `FieldDrafts` snapshot. `FieldEditor` forwards `editor.getJSON()` on TipTap's update event, `useComposer` replaces the snapshot, and a memo keyed on that identity calls `compileBrief`. The chain is update → snapshot → compile → render, with no subscriptions, effects, or second source of truth. Autosave is an effect on the snapshot debounced 300 ms writing `{ version: 1, drafts }` under `prompt-studio.draft`; hydration parses it with a lenient zod store schema and falls back to empty drafts. `per boundary-discipline`: localStorage and clipboard are parsed at the edge, and the interior trusts `Brief`.

**Theme.** `type ThemeChoice = 'light' | 'dark' | 'system'` is the only stored theme state; `resolved` is derived from it and a `matchMedia` listener that is active only while choice is `'system'`. One effect toggles `documentElement`'s `dark` class. Unknown stored values fall back to `'system'`.

**Modules.** `brief/schema.ts` (contract and JSON Schema), `brief/compile.ts` (derive, validate, stringify), `brief/markdown.ts` (serializer and list readers), `brief/fields.ts` (specs and ids), `editor/FieldEditor.tsx` plus `editor/extensions.ts` (TipTap instance, toolbar, closed schema), `app/useComposer.ts` (snapshot and autosave), `theme/theme.ts` (choice and resolution), `ui/` (panels, tabs, copy/download).

**Interface depth.** `brief/` exports one value (`briefJsonSchema`), one type (`Brief`), one function (`compileBrief`) and hides derivation, validation, and serialization. `FieldEditor` hides instance lifecycle, extension set, and toolbar pressed-state. Four field specs drive four editors from one component; nothing callers touch is an internal stage. Accessibility rides on the same surface: real buttons with `aria-pressed` from `editor.isActive`, roving-tabindex tab buttons for the two panels, and an `aria-live` region for issues.

## Synthesis decision

## Tradeoffs accepted

- We accept writing the four derivation lines explicitly instead of generating them from `FIELDS`, in exchange for the payload shape living in one readable place rather than in a descriptor engine.
- We accept a hand-written markdown serializer for a whitelisted node set, in exchange for toolbar and serializer being provably the same capability and for skipping a markdown parser entirely.
- We accept compiling on every keystroke with no debounce or worker, in exchange for a preview that is always exact; `compileBrief` is pure, so it can be moved off-thread if documents ever get large.
- We accept that `pathItems` only reads bullet items, in exchange for a predictable contract; prose containing paths is dropped rather than guessed.
- We accept that `Brief` types strings as non-empty only at parse time, in exchange for using `z.infer` unchanged; copy and download stay disabled until `ok`.

## Alternatives considered

- Registry-driven fields: each descriptor carries its zod field, editor, and derive function, and the schema is assembled from descriptors. It looks DRY, but `z.infer` degrades to runtime-built types, `z.toJSONSchema` output becomes order-sensitive, and the keystroke path gains a dynamic lookup. Rejected: it exposes schema assembly to callers and hides little.
- Derive arrays directly from the ProseMirror tree with no markdown: two walkers and two formatting policies (one for prose strings, one for lists) in exchange for a few saved lines. Rejected: it duplicates the representation decision.
- `react-hook-form` with a zod resolver around TipTap: editors are not registerable, so the design grows an adapter, uncontrolled-input plumbing, and a validation layer that duplicates `compileBrief`. Rejected: more surface, same knowledge.

## Open questions and risks

- Does the downstream agent want markdown emphasis inside `goal` and `constraints`, or plain prose? The sketch assumes markdown is welcome.
- Should `fileReferences` also harvest inline-code spans, or is bullet-only the instruction users will read from the placeholder?
- Is `schemaVersion: z.literal(1)` right, or should it be a string semver that can widen without a schema change?
- `z.toJSONSchema` emits `$schema`/`$id` keys differently by target and meta settings; is a snapshot test of the emitted object enough to keep the Schema tab honest?
- Can `bullet` and `code` marks be enabled per field without the toolbar drifting from the serializer whitelist? The design pairs them but does not enforce it in types.

## Next implementation step

Write `brief/schema.ts` and a snapshot test of `briefJsonSchema` plus one valid and one invalid parse, then build `compileBrief` against fixed sample drafts before any TipTap rendering exists.
