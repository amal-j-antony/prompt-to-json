import type { Editor } from '@tiptap/core'
import {
  Bold,
  Code,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
  type LucideIcon,
} from 'lucide-react'

export type ToolbarActionId =
  | 'bold'
  | 'italic'
  | 'code'
  | 'bulletList'
  | 'orderedList'
  | 'blockquote'
  | 'undo'
  | 'redo'

export interface ToolbarAction {
  id: ToolbarActionId
  label: string
  shortcut: string
  keyshortcut: string
  icon: LucideIcon
  isActive(editor: Editor): boolean
  canRun(editor: Editor): boolean
  run(editor: Editor): void
}

export const TOOLBAR_ACTIONS: Record<ToolbarActionId, ToolbarAction> = {
  bold: {
    id: 'bold',
    label: 'Bold',
    shortcut: 'Ctrl+B',
    keyshortcut: 'Control+B Meta+B',
    icon: Bold,
    isActive: (editor) => editor.isActive('bold'),
    canRun: () => true,
    run: (editor) => {
      editor.chain().focus().toggleBold().run()
    },
  },
  italic: {
    id: 'italic',
    label: 'Italic',
    shortcut: 'Ctrl+I',
    keyshortcut: 'Control+I Meta+I',
    icon: Italic,
    isActive: (editor) => editor.isActive('italic'),
    canRun: () => true,
    run: (editor) => {
      editor.chain().focus().toggleItalic().run()
    },
  },
  code: {
    id: 'code',
    label: 'Inline code',
    shortcut: 'Ctrl+E',
    keyshortcut: 'Control+E Meta+E',
    icon: Code,
    isActive: (editor) => editor.isActive('code'),
    canRun: () => true,
    run: (editor) => {
      editor.chain().focus().toggleCode().run()
    },
  },
  bulletList: {
    id: 'bulletList',
    label: 'Bullet list',
    shortcut: 'Ctrl+Shift+8',
    keyshortcut: 'Control+Shift+8 Meta+Shift+8',
    icon: List,
    isActive: (editor) => editor.isActive('bulletList'),
    canRun: () => true,
    run: (editor) => {
      editor.chain().focus().toggleBulletList().run()
    },
  },
  orderedList: {
    id: 'orderedList',
    label: 'Numbered list',
    shortcut: 'Ctrl+Shift+7',
    keyshortcut: 'Control+Shift+7 Meta+Shift+7',
    icon: ListOrdered,
    isActive: (editor) => editor.isActive('orderedList'),
    canRun: () => true,
    run: (editor) => {
      editor.chain().focus().toggleOrderedList().run()
    },
  },
  blockquote: {
    id: 'blockquote',
    label: 'Quote',
    shortcut: 'Ctrl+Shift+B',
    keyshortcut: 'Control+Shift+B Meta+Shift+B',
    icon: Quote,
    isActive: (editor) => editor.isActive('blockquote'),
    canRun: () => true,
    run: (editor) => {
      editor.chain().focus().toggleBlockquote().run()
    },
  },
  undo: {
    id: 'undo',
    label: 'Undo',
    shortcut: 'Ctrl+Z',
    keyshortcut: 'Control+Z Meta+Z',
    icon: Undo2,
    isActive: () => false,
    canRun: (editor) => editor.can().undo(),
    run: (editor) => {
      editor.chain().focus().undo().run()
    },
  },
  redo: {
    id: 'redo',
    label: 'Redo',
    shortcut: 'Ctrl+Shift+Z',
    keyshortcut: 'Control+Shift+Z Meta+Shift+Z',
    icon: Redo2,
    isActive: () => false,
    canRun: (editor) => editor.can().redo(),
    run: (editor) => {
      editor.chain().focus().redo().run()
    },
  },
}
