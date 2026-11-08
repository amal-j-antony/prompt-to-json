const { chromium } = require('playwright')
const fs = require('fs')

const SHOTS = 'docs/screenshots'
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'
fs.mkdirSync(SHOTS, { recursive: true })

const results = []
function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail })
  if (!condition) throw new Error(`FAIL ${name}: ${detail ?? ''}`)
}

async function payloadFrom(page) {
  const text = await page.locator('#panel-brief pre').innerText()
  return JSON.parse(text)
}

;(async () => {
  // The bundled Playwright browser is not installed; use system Chrome.
  const browser = await chromium.launch({ channel: 'chrome' })
  const errors = []

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1020 },
    colorScheme: 'dark',
    permissions: ['clipboard-read', 'clipboard-write'],
    acceptDownloads: true,
  })
  const page = await context.newPage()
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`))

  await page.goto(BASE_URL)
  await page.waitForSelector('.ProseMirror')
  check('four editors render', (await page.locator('.ProseMirror').count()) === 4)
  check(
    'no required error before the user types',
    (await page.getByText('Add a goal before exporting.').count()) === 0,
  )

  const darkAtBoot = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  check('system dark applied at boot', darkAtBoot)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `${SHOTS}/desktop-dark-empty.png`, fullPage: true })

  await page.getByRole('button', { name: 'Light theme' }).click()
  const lightApplied = await page.evaluate(
    () => !document.documentElement.classList.contains('dark'),
  )
  check('light theme applies', lightApplied)

  const editors = page.locator('.ProseMirror')

  await editors.nth(0).click()
  const boldButton = page.locator('section.field-shell').nth(0).getByRole('button', { name: /Bold \(/ })
  await boldButton.click()
  await page.keyboard.type('Ship a settings page')
  await boldButton.click()
  await page.keyboard.type(' with a theme toggle.')

  await editors.nth(1).click()
  await page.keyboard.type('- Stay client-only')
  await page.keyboard.press('Enter')
  await page.keyboard.type('No new dependencies')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')

  await editors.nth(2).click()
  await page.keyboard.type('- src/state/useTheme.ts')
  await page.keyboard.press('Enter')
  await page.keyboard.type('src/App.tsx')
  await page.keyboard.press('Enter')
  await page.keyboard.type('`src/state/useTheme.ts`')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')

  await editors.nth(3).click()
  await page.keyboard.type('- Should the toggle follow the OS?')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Which icon set should ship?')

  await page.waitForTimeout(500)

  const payload = await payloadFrom(page)
  check('schemaVersion is 1.0', payload.schemaVersion === '1.0', payload.schemaVersion)
  check('goal keeps bold markdown', payload.goal.startsWith('**Ship a settings page**'), payload.goal)
  check(
    'constraints keep bullet markdown',
    payload.constraints.includes('- Stay client-only') &&
      payload.constraints.includes('- No new dependencies'),
    payload.constraints,
  )
  check(
    'file references dedupe and strip backticks',
    JSON.stringify(payload.fileReferences) ===
      JSON.stringify(['src/state/useTheme.ts', 'src/App.tsx']),
    JSON.stringify(payload.fileReferences),
  )
  check('open questions split into two items', payload.openQuestions.length === 2, payload.openQuestions)

  check('status reads Valid', (await page.getByText('Valid', { exact: true }).count()) === 1)
  const copyButton = page.getByRole('button', { name: 'Copy JSON' })
  check('copy enabled once valid', await copyButton.isEnabled())
  check('download enabled once valid', await page.getByRole('button', { name: 'Download brief.json' }).isEnabled())

  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `${SHOTS}/desktop-light.png`, fullPage: true })

  await page.getByRole('button', { name: 'Save brief' }).click()
  await page.waitForTimeout(150)
  check('save shows a toast', (await page.getByRole('status').innerText()).includes('Saved to history'))
  check(
    'history count is one',
    (await page.getByRole('button', { name: /History, 1 saved brief/ }).count()) === 1,
  )

  await page.getByRole('button', { name: /History, 1 saved brief/ }).click()
  await page.waitForTimeout(350)
  const drawer = page.getByRole('dialog')
  check('history drawer opens', await drawer.isVisible())
  check(
    'history row uses the goal as its title',
    (await drawer.getByText('Ship a settings page with a theme toggle.', { exact: true }).count()) === 1,
  )
  await page.screenshot({ path: `${SHOTS}/desktop-light-history.png` })
  await page.getByRole('button', { name: 'Close history' }).click()

  await page.getByRole('button', { name: 'Save brief' }).click()
  await page.waitForTimeout(150)
  check(
    'second save reports a duplicate',
    (await page.getByRole('status').innerText()).includes('already the newest save'),
  )
  check(
    'duplicate does not add an entry',
    (await page.getByRole('button', { name: /History, 1 saved brief/ }).count()) === 1,
  )

  await editors.nth(0).click()
  await page.keyboard.press('Control+a')
  await page.keyboard.type('Changed goal')
  await page.waitForTimeout(150)
  check('goal changed before load', (await payloadFrom(page)).goal === 'Changed goal')

  await page.getByRole('button', { name: /History, 1 saved brief/ }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Load', exact: true }).click()
  await page.waitForTimeout(300)
  const restored = await payloadFrom(page)
  check('load restores the saved goal', restored.goal === payload.goal, restored.goal)
  check('drawer closes after load', (await page.getByRole('dialog').count()) === 0)

  await copyButton.click()
  await page.waitForTimeout(150)
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  check('copy writes the exact payload', JSON.parse(clipboard).goal === payload.goal)
  check('toast confirms copy', (await page.getByRole('status').innerText()).includes('copied'))

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download brief.json' }).click(),
  ])
  check('download filename', download.suggestedFilename() === 'brief.json', download.suggestedFilename())
  const downloadPath = `/tmp/${download.suggestedFilename()}`
  await download.saveAs(downloadPath)
  const downloaded = JSON.parse(fs.readFileSync(downloadPath, 'utf8'))
  check('downloaded file matches payload', downloaded.goal === payload.goal)

  await page.getByRole('tab', { name: 'JSON Schema' }).click()
  const schemaText = await page.locator('#panel-schema pre').innerText()
  check('schema tab shows draft 2020-12', schemaText.includes('json-schema.org/draft/2020-12'))
  check('schema tab has AgentBrief', schemaText.includes('AgentBrief'))
  check('schema lists fileReferences', schemaText.includes('fileReferences'))
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `${SHOTS}/desktop-light-schema.png`, fullPage: true })
  await page.getByRole('tab', { name: 'Brief JSON' }).click()

  await page.reload()
  await page.waitForSelector('.ProseMirror')
  const afterReload = await payloadFrom(page)
  check('draft persists across reload', afterReload.goal === payload.goal, afterReload.goal)
  check(
    'theme choice persists across reload',
    await page.evaluate(() => !document.documentElement.classList.contains('dark')),
  )

  await page.getByRole('button', { name: 'Dark theme' }).click()
  await page.waitForTimeout(120)
  check(
    'dark theme applies',
    await page.evaluate(() => document.documentElement.classList.contains('dark')),
  )
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `${SHOTS}/desktop-dark-filled.png`, fullPage: true })

  await page.getByRole('button', { name: /History, 1 saved brief/ }).click()
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${SHOTS}/desktop-dark-history.png` })
  await page.getByRole('button', { name: 'Close history' }).click()

  check(
    'history survives reload',
    (await page.getByRole('button', { name: /History, 1 saved brief/ }).count()) === 1,
  )

  await page.getByRole('button', { name: /History, 1 saved brief/ }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete "Ship a settings page with a theme toggle."' }).click()
  check('delete empties the list', await page.getByText('No saved briefs yet.').isVisible())
  await page.screenshot({ path: `${SHOTS}/desktop-light-history-empty.png` })
  await page.getByRole('button', { name: 'Close history' }).click()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  check('no horizontal overflow at 1440', overflow <= 0, overflow)

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Reset' }).click()
  await page.waitForTimeout(300)
  const afterReset = await payloadFrom(page)
  check('reset clears the goal', afterReset.goal === '')
  check(
    'reset clears stored draft',
    (await page.evaluate(() => localStorage.getItem('prompt-studio.draft.v1'))) === null,
  )

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'light',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const mobilePage = await mobile.newPage()
  mobilePage.on('pageerror', (error) => errors.push(`MOBILE ${error.message}`))
  await mobilePage.goto(BASE_URL)
  await mobilePage.waitForSelector('.ProseMirror')
  const mobileOverflow = await mobilePage.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  check('no horizontal overflow at 390', mobileOverflow <= 0, mobileOverflow)
  await mobilePage.screenshot({ path: `${SHOTS}/mobile-light.png`, fullPage: true })
  await mobilePage.getByRole('button', { name: /History, 0 saved briefs/ }).click()
  await mobilePage.waitForTimeout(350)
  await mobilePage.screenshot({ path: `${SHOTS}/mobile-history.png` })
  await mobilePage.getByRole('button', { name: 'Close history' }).click()
  await mobilePage.getByRole('button', { name: 'Dark theme' }).click()
  await mobilePage.screenshot({ path: `${SHOTS}/mobile-dark.png`, fullPage: true })

  check('no console errors', errors.length === 0, errors.join(' | '))

  await browser.close()
  console.log(JSON.stringify({ passed: results.filter((r) => r.ok).length, results, errors }, null, 2))
})().catch((error) => {
  console.error(error.message)
  console.error(JSON.stringify({ results }, null, 2))
  process.exit(1)
})
