export interface FieldControl {
  focus(): void
  clear(): void
  undo(): void
  isEmpty(): boolean
}
