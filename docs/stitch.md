# Stitch MCP

Prompt Studio was designed without Stitch. This environment had no Stitch MCP server and no `STITCH_API_KEY`, and Stitch needs a Google Cloud project with the Stitch API enabled. This page covers the setup and the handoff.

## 1. Authenticate

Use the official setup wizard and pick OpenCode:

```sh
npx @_davideast/stitch-mcp init -c opencode
```

The wizard installs gcloud, runs OAuth, enables the Stitch API, tests the connection, and writes the MCP config.

To use an API key instead, set it in your shell and skip OAuth:

```sh
export STITCH_API_KEY="your-key"
```

The key comes from the Stitch app. The Google Cloud project needs billing enabled and the Stitch API turned on.

## 2. Register the server

Let OpenCode write the config:

```sh
opencode mcp add stitch --env STITCH_API_KEY={env:STITCH_API_KEY} -- npx -y @_davideast/stitch-mcp proxy
opencode mcp list
```

Or add it by hand to `opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "stitch": {
        "type": "local",
        "command": ["npx", "-y", "@_davideast/stitch-mcp", "proxy"],
        "environment": {
          "STITCH_API_KEY": "{env:STITCH_API_KEY}"
        }
      }
    }
  }
}
```

Restart OpenCode, run `/mcps`, and confirm the server shows as connected.

## 3. Generate the screen

Paste this prompt after the server connects:

```text
Design a desktop web app called Prompt Studio for composing a structured brief for a coding agent. Dark and light themes.

Layout: a sticky top bar with a small braces logo, the name Prompt Studio, the line "Four fields in. One agent-ready brief out.", a four-segment completion meter, a History button with a saved count, a light/dark/system theme control, and a Reset button. Below it, two columns. The left column is a stack of four cards, numbered 01 to 04: Goal, Constraints, File references, Open questions. Each card has an icon, a one-line hint, a rich-text toolbar with bold, italic, inline code, bullet list, numbered list, quote, undo, and redo, a roomy editor, and a footer with a Markdown shortcut hint. The right column is a sticky output panel titled "Agent brief" with a Valid or Incomplete badge, two tabs named "Brief JSON" and "JSON Schema", a monospace code block, a full-width "Save brief" button, and a row with "Copy JSON" and "Download brief.json". Add a right-side history drawer that lists saved briefs, each with a title, saved time, field count, Load, and Delete, plus a Clear all action and an empty state.

Style: neutral slate and near-black surfaces, a violet accent, 16 px card radii, soft shadows, crisp 12 to 15 px type, and a sparse layout that feels like a developer tool rather than a form. Keep both themes legible and quiet.
```

Stitch returns screens with HTML and screenshots. Preview them with:

```sh
npx @_davideast/stitch-mcp screens -p <project-id>
npx @_davideast/stitch-mcp serve -p <project-id>
```

## 4. Apply the design

The app's visual layer is `src/styles.css` plus the Tailwind classes in `src/ui/`, `src/editor/`, and `src/App.tsx`. Replace token values first. Change the component classes only where the Stitch layout differs. Keep `src/brief/` untouched: the JSON contract, serializer, and compiler are independent of the design.

The architecture sketches behind the current build are in `docs/design-a.md` and `docs/design-b.md`, and the implementation contract is `docs/spec.md`.
