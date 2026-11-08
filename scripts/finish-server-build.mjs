import { mkdir, writeFile } from 'node:fs/promises'

await mkdir('dist-server', { recursive: true })
await writeFile('dist-server/package.json', JSON.stringify({ type: 'commonjs' }))
