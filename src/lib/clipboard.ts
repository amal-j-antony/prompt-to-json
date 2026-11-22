function copyWithTextarea(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.top = '0'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(area)
  return copied
}

export async function copyText(text: string): Promise<boolean> {
  let copied = false

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      copied = true
    } catch {
      copied = false
    }
  }

  if (copied) return true

  try {
    return copyWithTextarea(text)
  } catch {
    return false
  }
}
