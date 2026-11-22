const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const PORT = 4173
const BASE_URL = `http://localhost:${PORT}`
const DESKTOP_DIST = path.resolve('dist-desktop')

const results = []
function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail })
  if (!condition) throw new Error(`FAIL ${name}: ${detail ?? ''}`)
}

async function waitForServer(url, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Preview server did not start at ${url}`)
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'chrome' })
  } catch {
    return await chromium.launch()
  }
}

if (!fs.existsSync(path.join(DESKTOP_DIST, 'index.html'))) {
  console.error('Missing dist-desktop. Run `npm run build:desktop` first.')
  process.exit(1)
}

const detached = process.platform !== 'win32'
const server = spawn(
  'npm',
  ['run', 'preview', '--', '--mode', 'desktop', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore', detached, shell: process.platform === 'win32' },
)

function stopServer() {
  if (!server.pid) return
  if (!detached) {
    server.kill()
    return
  }
  try {
    process.kill(-server.pid, 'SIGTERM')
  } catch {
    try {
      server.kill('SIGTERM')
    } catch {}
  }
}

;(async () => {
  let browser
  try {
    await waitForServer(BASE_URL)
    browser = await launchBrowser()

    const context = await browser.newContext({
      viewport: { width: 1440, height: 1020 },
      colorScheme: 'dark',
      permissions: ['clipboard-read', 'clipboard-write'],
      acceptDownloads: true,
    })
    const page = await context.newPage()
    const apiRequests = []
    const errors = []

    page.on('request', (request) => {
      if (request.url().includes('/api/')) apiRequests.push(request.url())
    })
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`))
    page.on('dialog', (dialog) => {
      void dialog.accept()
    })

    await page.goto(BASE_URL)
    await page.waitForSelector('.ProseMirror')

    check(
      'desktop hides the server status pill',
      (await page.getByText(/Server online|Waking server|Database offline|Server offline/).count()) === 0,
    )
    check(
      'desktop hides sign in',
      (await page.getByRole('button', { name: /Sign in/i }).count()) === 0,
    )
    check(
      'desktop footer reports local storage',
      (await page.getByText('Stored on this device. Nothing is sent anywhere.').count()) === 1,
    )

    const editors = page.locator('.ProseMirror')
    await editors.first().click()
    await page.keyboard.type('Ship a desktop smoke brief')
    await page.waitForTimeout(500)

    const payload = JSON.parse(await page.locator('#panel-brief pre').innerText())
    check('desktop payload is valid', payload.goal === 'Ship a desktop smoke brief', payload.goal)

    await page.getByRole('button', { name: 'Save brief' }).click()
    await page.getByText('Saved to history.').waitFor()

    await page.reload()
    await page.waitForSelector('.ProseMirror')
    check(
      'desktop draft survives reload',
      (await page.locator('#panel-brief pre').innerText()).includes('Ship a desktop smoke brief'),
    )

    await page.getByRole('button', { name: /History/ }).click()
    await page.getByRole('dialog', { name: 'History' }).waitFor()
    check(
      'desktop history shows the saved brief',
      (await page.getByText('Ship a desktop smoke brief').count()) >= 1,
    )

    const [historyDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export' }).click(),
    ])
    check(
      'history export is named for the app',
      historyDownload.suggestedFilename() === 'prompt-studio-history.json',
      historyDownload.suggestedFilename(),
    )
    const historyPath = path.join(os.tmpdir(), 'prompt-studio-history-export.json')
    await historyDownload.saveAs(historyPath)
    const exported = JSON.parse(fs.readFileSync(historyPath, 'utf8'))
    check(
      'history export contains one entry',
      exported.version === 2 && exported.entries.length === 1,
      JSON.stringify(exported).slice(0, 200),
    )

    await page.getByRole('button', { name: 'Clear all' }).click()
    await page.getByText('No saved briefs yet.').waitFor()

    await page.locator('input[type=file]').setInputFiles(historyPath)
    await page.getByText('Imported 1 brief.').waitFor()
    check(
      'history import restores the entry',
      (await page.getByText('Ship a desktop smoke brief').count()) >= 1,
    )

    await page.getByRole('button', { name: 'Close history' }).click()
    await page.getByRole('button', { name: 'Copy JSON' }).click()
    await page.getByText('Brief copied to the clipboard.').waitFor()
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    check('copy writes the brief JSON', JSON.parse(clipboard).goal === payload.goal)

    const [briefDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download brief.json' }).click(),
    ])
    check(
      'brief download keeps its filename',
      briefDownload.suggestedFilename() === 'brief.json',
      briefDownload.suggestedFilename(),
    )

    await page.getByRole('tab', { name: 'JSON Schema' }).click()
    const schemaText = await page.locator('#panel-schema pre').innerText()
    check('schema tab renders offline', schemaText.includes('json-schema.org/draft/2020-12'))

    check('desktop makes no API requests', apiRequests.length === 0, apiRequests.join(', '))
    check('desktop logs no console errors', errors.length === 0, errors.join(' | '))

    console.log(`desktop checks: ${results.length} passed`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  } finally {
    if (browser) await browser.close()
    stopServer()
  }
})()
