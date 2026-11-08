# Design B: one registry, four fields
## Problem
Prompt Studio is four rich-text fields that differ only in label, help copy, and whether the payload value is a markdown string or a `string[]`; editor, toolbar, shortcuts, a11y wiring, and validation display are identical. Four per-field components duplicate that shell and drift. The non-obvious constraint is "the live payload always validates against the displayed schema": payload, validation, and schema panel must come from one declaration. Phase A is skipped; the only inherited constraints are the fixed stack and the four-field brief.

## Usage (caller's view)
```tsx
// form: a loop over the registry
import { FIELD_REGISTRY } from "@/brief/registry";
{FIELD_REGISTRY.map(spec =>
  <FieldEditor key={spec.id} spec={spec} doc={docs[spec.id]} onChange={setDoc} />)}

// contract gate
import { compileBrief } from "@/brief/compile";
const check = compileBrief(docs);        // { ok, payload } | { ok, issues }

// schema tab: the same object validation uses
import { BRIEF_JSON_SCHEMA } from "@/brief/schema";
<pre>{JSON.stringify(BRIEF_JSON_SCHEMA, null, 2)}</pre>
```
A fifth field is one registry row plus one `BriefSchema` key; form, toolbar, counts, validation, and assembler pick it up untouched.

## Shape
```ts
// brief/registry.ts — pure data, no React import
export type FieldId = "goal" | "constraints" | "fileReferences" | "openQuestions";
export type PayloadKind = "markdown" | "items";
export type IconName = "target" | "lock" | "file" | "help";
export interface FieldSpec {
  id: FieldId; label: string; placeholder: string; help: string;
  icon: IconName; group: "intent" | "scope";   // ui/Icon resolves the component
  kind: PayloadKind; required: boolean;        // kind selects codec + zod shape
  toolbar: readonly ("bold" | "italic" | "code" | "bulletList" | "orderedList" | "heading")[];
}
export const FIELD_REGISTRY: readonly FieldSpec[] = [/* four rows */];
```
```ts
// brief/kinds.ts — each payload shape is declared exactly once
export interface PayloadCodec<T extends string | string[]> {
  empty: T;
  encode(doc: JSONContent): T;                        // ProseMirror JSON -> payload value
  schema: { any: z.ZodType<T>; filled: z.ZodType<T> }; // filled = required semantics
}
export const PAYLOAD_KINDS: { markdown: PayloadCodec<string>; items: PayloadCodec<string[]> } = {
  markdown: { empty: "", encode: d => serializeMarkdown(d).trim(),
              schema: { any: z.string(), filled: z.string().trim().min(1) } },
  items:    { empty: [], encode: d => topLevelListItems(d).map(serializeMarkdown).filter(Boolean),
              schema: { any: z.array(z.string()), filled: z.array(z.string().min(1)).min(1) } },
};
```
```ts
// brief/schema.ts and compile.ts — zod is the source of truth; the registry points at it
export const SCHEMA_VERSION = 1 as const;
const specOf = (id: FieldId) => FIELD_REGISTRY.find(s => s.id === id)!;
const schemaFor = (id: FieldId) => PAYLOAD_KINDS[specOf(id).kind].schema[specOf(id).required ? "filled" : "any"];
export const BriefSchema = z.object({ schemaVersion: z.literal(SCHEMA_VERSION),
  goal: schemaFor("goal"), constraints: schemaFor("constraints"),
  fileReferences: schemaFor("fileReferences"), openQuestions: schemaFor("openQuestions") });
export type Brief = z.infer<typeof BriefSchema>;
export const BRIEF_JSON_SCHEMA = z.toJSONSchema(BriefSchema, { target: "draft-2020-12" });

export type FieldDocs = Record<FieldId, JSONContent>;
export type BriefCheck = { ok: true; payload: Brief }
  | { ok: false; candidate: Record<string, unknown>; issues: Partial<Record<FieldId, string[]>> };
export function compileBrief(docs: FieldDocs): BriefCheck;  // safeParse over registry iteration
```
`useBriefDraft` owns `FieldDocs`; TipTap `onUpdate` writes back `editor.getJSON()`; `compileBrief` runs in a memo per keystroke and the panel shows `payload` when `ok`, else the candidate JSON plus messages from that same zod error. Requiredness lives only in the schema; the UI never re-checks it. Issue paths start with the field id, so no mapping table. Registry ids are checked against `Exclude<keyof Brief, "schemaVersion">` at compile time and `BriefSchema.shape` in one test.

Theme is separate state; `preference` persists with the draft, `resolved` folds through `useSyncExternalStore` on `matchMedia("(prefers-color-scheme: dark)")` so "system" tracks the OS live, and an effect toggles `document.documentElement.classList` for Tailwind v4's `@custom-variant dark`.
```ts
export type ThemePreference = "dark" | "light" | "system";
export function useTheme(): { preference: ThemePreference; resolved: "dark" | "light";
                              setPreference(p: ThemePreference): void };
```
```
src/brief/{registry,kinds,schema,compile,draft}.ts   data, contract, persistence schema
src/editor/{FieldEditor,Toolbar}.tsx                 one editor shell for every spec
src/editor/actions.ts                                toolbar id -> label, shortcut, TipTap command
src/state/{useBriefDraft,useTheme}.ts                docs + debounced autosave, theme
src/ui/{BriefForm,OutputPanel,ThemeToggle}.tsx       registry map, payload/schema tabs, copy/download
```
Interface depth: callers touch `FIELD_REGISTRY`, `compileBrief`, `useBriefDraft`, and two components. Hidden: schema construction, markdown/list derivation, requiredness, issue grouping, autosave, theme resolution. Exposed: `FieldSpec` and `FieldDocs`, the actual concepts. No larger surface is needed because four homogeneous fields and two value shapes do not justify conditional fields, cross-field rules, or a form engine; generalization starts at the second occurrence (`per laziness-protocol`). Every per-field difference is a column (`per model-the-domain`), external data is parsed once at the storage and payload boundaries (`per boundary-discipline`), and payload types are inferred, never hand-declared (`per type-system-discipline`).

Per-field components lose because the shared shell is most of the code: four toolbars, four `aria-describedby` sets, four places to fix one shortcut. The registry makes "apply to all fields" a loop that cannot forget a field, and the spec table reviews in one screen. A11y follows: ids, labels, help, and error refs are generated from the spec; toolbar buttons come from `actions.ts` with `aria-pressed` and `aria-keyshortcuts`; TipTap input rules supply `- ` and `1. `; validity is announced in a polite live region. Deliberately absent: payload import back into editors, in-app schema editing, per-field custom renderers, markdown→document parsing of stored payloads.

## Synthesis decision

## Tradeoffs accepted
- We accept that bespoke field behavior needs a declared capability rather than a special component, in exchange for one render and validation path.
- We accept disabled copy/download while a required field is empty, in exchange for "every emitted brief validates against the shown schema."
- We accept lossy `items` encoding (nested bullets flatten into the parent string) in exchange for a flat `string[]` contract.
- We accept re-parsing per keystroke and shipping all of zod to the client, in exchange for zero duplicated validation.
- We accept whatever `z.toJSONSchema` emits (titles, `$schema`, key order) in exchange for never maintaining a second schema by hand.
- We accept one localStorage record for docs and theme, in exchange for atomic saves and one hydration path.

## Alternatives considered
- **Per-field components sharing a `useRichField` hook.** The hook hides editor setup, not validation display, toolbar, or a11y wiring, which still exist four times; differences become branches. Four components for callers to know loses on interface depth.
- **Schema-driven auto-form (zod → generic renderer), no registry.** Rich text has no schema representation, so placeholder, icon, group, and toolbar need side tables anyway; reflection machinery buys nothing over a 20-line table (`per subtract-before-you-add`).
- **Raw `<textarea>` storing markdown.** Meets the payload but not the toolbar or bullet shortcuts, and makes the user responsible for markdown correctness.

## Open questions and risks
- Are all four fields required, or may open questions be empty? The registry `required` flag is the only switch either way.
- For `items`, should top-level paragraphs merge into the previous item (current sketch) or be dropped?
- Should the schema tab render `BRIEF_JSON_SCHEMA` verbatim including `$schema`, or a trimmed copy? Verbatim is assumed.
- Do we flush the debounced autosave on `pagehide` to survive tab close, and does that add a sync-write cost?
- TipTap v3 with React 19 is young; verify input rules and `onUpdate` before building on them.
- A stored draft containing unknown node types must degrade to that field's empty doc, not throw.

## Next implementation step
Write `src/brief/registry.ts`, `kinds.ts`, and `schema.ts`, with a test that registry ids equal `BriefSchema.shape` keys and that an empty draft compiles only when all required fields are filled.
