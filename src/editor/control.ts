export interface FieldControl {
  focus(): void
  clear(): void
  undo(): void
  isEmpty(): boolean
  insert(text: string): void
}
