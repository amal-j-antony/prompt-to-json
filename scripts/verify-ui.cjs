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
  const controlFor = (id) =>
    page
      .locator('section.field-shell', { has: page.locator(`#field-${id}-label`) })
      .locator('.ProseMirror, textarea')
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`))

  await page.goto(BASE_URL)
  await page.waitForSelector('.ProseMirror')
  check(
    'eight fields render',
    (await page.locator('section.field-shell header > span.font-mono').count()) === 8,
  )
  check('three rich editors render', (await page.locator('.ProseMirror').count()) === 3)
  check('five list editors render', (await page.locator('textarea').count()) === 5)
  check('brief check starts thin', (await page.getByText('Thin brief').count()) === 1)
  check(
    'no required error before the user types',
    (await page.getByText('Add a goal before exporting.').count()) === 0,
  )
  check(
    'goal starts expanded',
    (await page.getByRole('button', { name: 'Collapse Goal' }).count()) === 1,
  )
  check(
    'optional fields start collapsed',
    (await page.getByRole('button', { name: 'Expand Done when' }).count()) === 1,
  )
  await page.getByRole('button', { name: 'Expand all' }).click()
  await page.waitForTimeout(100)
  check(
    'expand all opens the optional fields',
    (await page.getByRole('button', { name: 'Collapse Done when' }).count()) === 1,
  )
  const briefCheckInOutput = await page
    .locator('section[aria-labelledby="brief-check-label"]')
    .evaluate((element) => Boolean(element.closest('section.field-shell')))
  check('brief check sits in the agent brief panel', briefCheckInOutput)
  const briefCheckBeforeCopy = await page.evaluate(() => {
    const briefCheck = document.querySelector('section[aria-labelledby="brief-check-label"]')
    const copy = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Copy JSON'),
    )
    if (!briefCheck || !copy) return false
    return Boolean(
      briefCheck.compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })
  check('brief check appears before copy', briefCheckBeforeCopy)
  check(
    'preset bar renders five starters',
    (await page.getByRole('group', { name: 'Start from' }).getByRole('button').count()) === 5,
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

  const historyButton = page.getByRole('button', { name: /History, 0 saved briefs/ })
  const downloadButton = page.getByRole('button', { name: 'Download brief.json' })
  const pointerCursor = await historyButton.evaluate((element) => getComputedStyle(element).cursor)
  check('action buttons use a pointer cursor', pointerCursor === 'pointer', pointerCursor)
  const disabledCursor = await downloadButton.evaluate((element) => getComputedStyle(element).cursor)
  check('disabled actions use a not-allowed cursor', disabledCursor === 'not-allowed', disabledCursor)

  await controlFor('goal').click()
  const goalSection = page.locator('section.field-shell', { has: page.locator('#field-goal-label') })
  const boldButton = goalSection.getByRole('button', { name: /Bold \(/ })
  await boldButton.click()
  await page.keyboard.type('Ship a settings page')
  await boldButton.click()
  await page.keyboard.type(' with a theme toggle.')

  await controlFor('done').click()
  await page.keyboard.type('Choosing dark survives a reload')

  await controlFor('details').click()
  await page.keyboard.type('Dark mode persists across reloads.')

  await controlFor('nonGoals').click()
  await page.keyboard.type('Do not add a theme editor')

  await controlFor('constraints').click()
  await page.keyboard.type('- Stay client-only')
  await page.keyboard.press('Enter')
  await page.keyboard.type('No new dependencies')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')

  await controlFor('files').click()
  await page.keyboard.type('src/state/useTheme.ts')
  await page.keyboard.press('Enter')
  await page.keyboard.type('src/App.tsx')
  await page.keyboard.press('Enter')
  await page.keyboard.type('`src/state/useTheme.ts`')

  await controlFor('verify').click()
  await page.keyboard.type('npm test')
  await page.keyboard.press('Enter')
  await page.keyboard.type('npm run verify:ui')

  await controlFor('questions').click()
  await page.keyboard.type('Should the toggle follow the OS?')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Which icon set should ship?')

  await page.waitForTimeout(500)

  const payload = await payloadFrom(page)
  check('schemaVersion is 3.0', payload.schemaVersion === '3.0', payload.schemaVersion)
  check('kind is a feature', payload.kind === 'feature', payload.kind)
  check('goal keeps bold markdown', payload.goal.startsWith('**Ship a settings page**'), payload.goal)
  check(
    'details keep their text',
    payload.details === 'Dark mode persists across reloads.',
    payload.details,
  )
  check(
    'acceptance criteria keep their items',
    JSON.stringify(payload.acceptanceCriteria) === JSON.stringify(['Choosing dark survives a reload']),
    payload.acceptanceCriteria,
  )
  check(
    'non-goals keep their items',
    JSON.stringify(payload.nonGoals) === JSON.stringify(['Do not add a theme editor']),
    payload.nonGoals,
  )
  check(
    'verification keeps its commands',
    JSON.stringify(payload.verification) === JSON.stringify(['npm test', 'npm run verify:ui']),
    payload.verification,
  )
  const briefCheckText = await page
    .locator('section[aria-labelledby="brief-check-label"]')
    .innerText()
  check('brief check reads strong', briefCheckText.includes('Strong brief'), briefCheckText)
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
  check('directives start empty', payload.directives.length === 0, payload.directives)

  const directiveChips = page.locator('[aria-labelledby="directives-label"] button')
  const chipCount = await directiveChips.count()
  for (let index = 0; index < chipCount; index += 1) {
    const chip = directiveChips.nth(index)
    const label = (await chip.innerText()).trim()
    const sentence = await chip.getAttribute('title')
    await chip.click()
    await page.waitForTimeout(150)
    const chipPayload = await payloadFrom(page)
    check(
      `${label} appends its sentence`,
      chipPayload.directives.length === 1 && chipPayload.directives[0] === sentence,
      chipPayload.directives,
    )
    await chip.click()
    await page.waitForTimeout(150)
    const chipOff = await payloadFrom(page)
    check(`${label} toggles off`, chipOff.directives.length === 0, chipOff.directives)
  }

  check('status reads Valid', (await page.getByText('Valid', { exact: true }).count()) === 1)
  const copyButton = page.getByRole('button', { name: 'Copy JSON' })
  check('copy enabled once valid', await copyButton.isEnabled())
  check('download enabled once valid', await page.getByRole('button', { name: 'Download brief.json' }).isEnabled())

  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `${SHOTS}/desktop-light.png`, fullPage: true })

  const transition = await copyButton.evaluate((element) => getComputedStyle(element).transitionProperty)
  check(
    'actions animate color and transform',
    transition.includes('background-color') && transition.includes('transform'),
    transition,
  )

  await copyButton.hover()
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${SHOTS}/desktop-light-actions.png`, fullPage: true })

  await page.getByRole('button', { name: 'Clear Goal' }).click()
  await page.waitForTimeout(250)
  check('per-field clear empties only the goal', (await payloadFrom(page)).goal === '')
  check(
    'per-field clear leaves other fields intact',
    (await controlFor('constraints').innerText()).includes('Stay client-only'),
  )
  const clearToast = page.getByRole('status')
  check('clear offers an undo action', (await clearToast.innerText()).includes('Undo'))
  await clearToast.getByRole('button', { name: 'Undo' }).click()
  await page.waitForTimeout(250)
  check('undo restores the cleared field', (await payloadFrom(page)).goal === payload.goal)

  await page.getByRole('button', { name: 'Clear Goal' }).click()
  await page.waitForTimeout(200)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(250)
  check('Ctrl+Z restores the cleared field', (await payloadFrom(page)).goal === payload.goal)

  await page.getByRole('button', { name: 'Clear Done when' }).click()
  await page.waitForTimeout(200)
  check(
    'list clear empties the done field',
    (await payloadFrom(page)).acceptanceCriteria.length === 0,
  )
  const listToast = page.getByRole('status')
  await listToast.getByRole('button', { name: 'Undo' }).click()
  await page.waitForTimeout(200)
  check(
    'list undo restores the done field',
    (await payloadFrom(page)).acceptanceCriteria[0] === 'Choosing dark survives a reload',
  )

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
  check('history rows count eight fields', (await drawer.innerText()).includes('of 8 fields'))
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

  await controlFor('goal').click()
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
  check('schema lists acceptanceCriteria', schemaText.includes('acceptanceCriteria'))
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
    (await page.evaluate(() => localStorage.getItem('prompt-studio.draft.v2'))) === null,
  )

  await page
    .getByRole('button', { name: 'Done when has at least one check', exact: true })
    .click()
  await page.waitForTimeout(150)
  check(
    'brief check opens the field it points to',
    (await page.getByRole('button', { name: 'Collapse Done when' }).count()) === 1,
  )

  await page.getByRole('button', { name: 'Suggest Done when has at least one check' }).click()
  await page.waitForTimeout(200)
  check(
    'suggestion fills the done field',
    (await payloadFrom(page)).acceptanceCriteria[0] === 'The change is visible in the UI.',
  )

  await page.getByRole('button', { name: 'Bug', exact: true }).click()
  await page.waitForTimeout(150)
  check(
    'bug mode relabels the first field',
    (await page.locator('#field-goal-label').innerText()) === 'Issue',
  )
  check(
    'bug mode shows seven fields',
    (await page.locator('section.field-shell header > span.font-mono').count()) === 7,
  )
  check(
    'bug mode explains the missing issue',
    (await page.getByText('Describe the issue to export this brief.').count()) === 1,
  )

  await controlFor('goal').click()
  await page.keyboard.type('Theme resets to light after every reload.')
  await page.waitForTimeout(150)
  const bugPayload = await payloadFrom(page)
  check('bug payload kind is bug', bugPayload.kind === 'bug', bugPayload.kind)
  check(
    'bug payload uses the issue key',
    bugPayload.issue === 'Theme resets to light after every reload.',
    bugPayload.issue,
  )
  check('bug payload has no goal key', !('goal' in bugPayload), Object.keys(bugPayload).join(','))

  await page.getByRole('button', { name: 'Feature', exact: true }).click()
  await page.waitForTimeout(150)
  check(
    'switching back restores the goal heading',
    (await page.locator('#field-goal-label').innerText()) === 'Goal',
  )
  check(
    'switching modes keeps the editor text',
    (await controlFor('goal').innerText()).includes('Theme resets to light'),
  )
  await page.getByRole('button', { name: 'Bug', exact: true }).click()
  await page.waitForTimeout(150)

  await page.getByRole('button', { name: 'Plan first' }).click()
  await page.waitForTimeout(150)
  check(
    'plan directive appends its sentence',
    (await payloadFrom(page)).directives[0] ===
      'Create a plan only. Do not edit the codebase until the user approves the plan.',
  )

  await page.getByRole('button', { name: 'Expand Repro and context' }).click()
  await page.waitForTimeout(100)

  await controlFor('details').click()
  await page.keyboard.type('Steps: set dark, reload. Expected dark. Actual light.')
  await page.waitForTimeout(500)
  check(
    'details land in the bug payload',
    (await payloadFrom(page)).details.includes('Steps: set dark, reload.'),
  )

  await page.reload()
  await page.waitForSelector('.ProseMirror')
  const afterBugReload = await payloadFrom(page)
  check('bug mode survives reload', afterBugReload.kind === 'bug', afterBugReload.kind)
  check(
    'bug issue survives reload',
    afterBugReload.issue === bugPayload.issue,
    afterBugReload.issue,
  )
  check('directive survives reload', afterBugReload.directives.length === 1, afterBugReload.directives)
  check(
    'bug heading survives reload',
    (await page.locator('#field-goal-label').innerText()) === 'Issue',
  )
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `${SHOTS}/desktop-dark-bug.png`, fullPage: true })

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Reset' }).click()
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: 'Expand all' }).click()
  await page.waitForTimeout(100)
  await controlFor('verify').click()
  await page.keyboard.type('Keep this proof')
  await page.getByRole('button', { name: 'Small bugfix' }).click()
  await page.waitForTimeout(250)
  check(
    'preset switches the work type',
    (await page
      .getByRole('button', { name: 'Bug', exact: true })
      .getAttribute('aria-pressed')) === 'true',
  )
  check(
    'preset fills the repro template',
    (await controlFor('details').innerText()).includes('Steps:'),
  )
  check(
    'preset keeps typed fields',
    (await controlFor('verify').inputValue()) === 'Keep this proof',
  )
  check(
    'preset fills empty list fields',
    JSON.stringify((await payloadFrom(page)).nonGoals) ===
      JSON.stringify(['Do not change unrelated behavior']),
  )
  const presetToast = page.getByRole('status')
  await presetToast.getByRole('button', { name: 'Undo' }).click()
  await page.waitForTimeout(250)
  const afterPresetUndo = await payloadFrom(page)
  check('preset undo clears the filled details', afterPresetUndo.details === '')
  check(
    'preset undo keeps typed fields',
    afterPresetUndo.verification[0] === 'Keep this proof',
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

  const reduced = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
  })
  const reducedPage = await reduced.newPage()
  await reducedPage.goto(BASE_URL)
  await reducedPage.waitForSelector('.ProseMirror')
  const reducedDuration = await reducedPage
    .getByRole('button', { name: /History, 0 saved briefs/ })
    .evaluate((element) => getComputedStyle(element).transitionDuration)
  check(
    'reduced motion removes transitions',
    reducedDuration.split(',').every((value) => Number.parseFloat(value) < 0.001),
    reducedDuration,
  )
  await reduced.close()

  check('no console errors', errors.length === 0, errors.join(' | '))

  await browser.close()
  console.log(JSON.stringify({ passed: results.filter((r) => r.ok).length, results, errors }, null, 2))
})().catch((error) => {
  console.error(error.message)
  console.error(JSON.stringify({ results }, null, 2))
  process.exit(1)
})
