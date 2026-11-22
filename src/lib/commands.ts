export interface CommandAction {
  id: string
  label: string
  hint?: string
  keywords?: string
  run(): void
}

export function filterCommands(
  actions: readonly CommandAction[],
  query: string,
): CommandAction[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [...actions]

  return actions.filter((action) => {
    const haystack = `${action.label} ${action.hint ?? ''} ${action.keywords ?? ''}`.toLowerCase()
    return haystack.includes(needle)
  })
}
