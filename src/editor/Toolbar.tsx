import type { Editor } from '@tiptap/core'
import { Fragment } from 'react'
import { useEditorState } from '@tiptap/react'
import { TOOLBAR_ACTIONS, type ToolbarActionId } from './actions'

interface ButtonState {
  pressed: boolean
  disabled: boolean
}

interface ToolbarProps {
  editor: Editor
  actions: readonly ToolbarActionId[]
}

export function Toolbar({ editor, actions }: ToolbarProps) {
  const states = useEditorState<Partial<Record<ToolbarActionId, ButtonState>>>({
    editor,
    selector: ({ editor: current }) => {
      const next: Partial<Record<ToolbarActionId, ButtonState>> = {}
      for (const id of actions) {
        const action = TOOLBAR_ACTIONS[id]
        next[id] = {
          pressed: action.isActive(current),
          disabled: !action.canRun(current),
        }
      }
      return next
    },
  })

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-0.5 border-y border-line bg-surface-2 px-3 py-1.5"
    >
      {actions.map((id, index) => {
        const action = TOOLBAR_ACTIONS[id]
        const state = states[id]
        const pressed = state?.pressed ?? false
        const disabled = state?.disabled ?? true
        const Glyph = action.icon

        return (
          <Fragment key={id}>
            {id === 'undo' && index > 0 ? (
              <span aria-hidden="true" className="mx-1 h-4 w-px bg-line" />
            ) : null}
            <button
              type="button"
              title={`${action.label} (${action.shortcut})`}
              aria-label={`${action.label} (${action.shortcut})`}
              aria-keyshortcuts={action.keyshortcut}
              aria-pressed={pressed}
              disabled={disabled}
              onMouseDown={(event) => {
                event.preventDefault()
              }}
              onClick={() => {
                action.run(editor)
              }}
              className={`grid h-7 w-7 place-items-center rounded-lg transition-colors duration-[160ms] disabled:pointer-events-none disabled:opacity-40 ${
                pressed
                  ? 'bg-accent-soft text-accent'
                  : 'text-muted hover:bg-surface-3 hover:text-ink'
              }`}
            >
              <Glyph aria-hidden="true" size={15} strokeWidth={1.75} />
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}
