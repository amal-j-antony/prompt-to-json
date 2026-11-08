const { chromium } = require('playwright')
const fs = require('fs')

const SHOTS = 'docs/screenshots'
const BASE_URL = process.env.BASE_URL || 'http://localhost:8787'
const PASSWORD = 'correct-horse-battery'
const emailA = `alice-${Date.now()}@example.test`
const emailB = `bob-${Date.now()}@example.test`

fs.mkdirSync(SHOTS, { recursive: true })

const results = []
function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail })
  if (!condition) throw new Error(`FAIL ${name}: ${detail ?? ''}`)
}

async function fillEditor(page, index, text) {
  const editor = page.locator('.ProseMirror').nth(index)
  await editor.click()
  await page.keyboard.press('Control+a')
  await page.keyboard.type(text)
}

async function signUp(page, email) {
  await page.getByRole('button', { name: 'Sign in' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('tab', { name: 'Create account' }).click()
  await dialog.getByLabel('Email').fill(email)
  await dialog.getByLabel('Password').fill(PASSWORD)
  await dialog.locator('form').getByRole('button', { name: 'Create account' }).click()
  await page.waitForTimeout(300)
  check('auth dialog closes after signup', (await page.getByRole('dialog').count()) === 0)
}

async function signIn(page, email) {
  await page.getByRole('button', { name: 'Sign in' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Email').fill(email)
  await dialog.getByLabel('Password').fill(PASSWORD)
  await dialog.locator('form').getByRole('button', { name: 'Sign in' }).click()
  await page.waitForTimeout(300)
  check('auth dialog closes after signin', (await page.getByRole('dialog').count()) === 0)
}

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1020 }, colorScheme: 'light' })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(`PAGEERROR ${error.message}`))

  await page.goto(BASE_URL)
  await page.waitForSelector('.ProseMirror')

  const online = page.getByRole('button', { name: 'Server online' })
  check('status pill reports an online server', (await online.count()) === 1)

  await page.route('**/api/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, db: 'error', uptime: 1 }),
    }),
  )
  await online.click()
  await page.waitForTimeout(250)
  check('degraded database shows in the pill', (await page.getByRole('button', { name: 'Database offline' }).count()) === 1)
  await page.unroute('**/api/health')
  await page.getByRole('button', { name: 'Database offline' }).click()
  await page.waitForTimeout(400)
  check('pill recovers when the database returns', (await page.getByRole('button', { name: 'Server online' }).count()) === 1)

  await fillEditor(page, 0, 'Ship the account history feature')
  await fillEditor(page, 1, '- MongoDB\n- Render')

  await signUp(page, emailA)
  check('signed in account menu appears', (await page.getByRole('button', { name: `${emailA} account menu` }).count()) === 1)
  check('footer names the account as the store', (await page.getByText('Saved briefs sync to your account.').count()) >= 1)

  await page.getByRole('button', { name: 'Save brief' }).click()
  await page.waitForTimeout(400)
  check('account save reports success', (await page.getByRole('status').innerText()).includes('Saved to history'))

  await page.getByRole('button', { name: /History, 1 saved brief/ }).click()
  await page.waitForTimeout(350)
  const drawer = page.getByRole('dialog')
  check('drawer says saved to the account', (await drawer.getByText('Saved to your account').count()) === 1)
  check(
    'account entry uses the goal title',
    (await drawer.getByText('Ship the account history feature', { exact: true }).count()) === 1,
  )
  await page.screenshot({ path: `${SHOTS}/desktop-account-history.png` })
  await page.getByRole('button', { name: 'Close history' }).click()

  await page.getByRole('button', { name: `${emailA} account menu` }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page.waitForTimeout(400)
  check('sign out returns to guest', (await page.getByRole('button', { name: 'Sign in' }).count()) === 1)
  check('guest history is empty in a fresh browser', (await page.getByRole('button', { name: /History, 0 saved briefs/ }).count()) === 1)

  await signUp(page, emailB)
  await page.waitForTimeout(400)
  check('second account starts empty', (await page.getByRole('button', { name: /History, 0 saved briefs/ }).count()) === 1)

  await page.getByRole('button', { name: `${emailB} account menu` }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page.waitForTimeout(300)

  await signIn(page, emailA)
  await page.waitForTimeout(600)
  check(
    'first account history returns after signin',
    (await page.getByRole('button', { name: /History, 1 saved brief/ }).count()) === 1,
  )

  await page.getByRole('button', { name: /History, 1 saved brief/ }).click()
  await page.waitForTimeout(350)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Load', exact: true }).click()
  await page.waitForTimeout(400)
  const goalText = await page.locator('.ProseMirror').nth(0).innerText()
  check('load restores the account snapshot', goalText.includes('Ship the account history feature'), goalText)

  await page.reload()
  await page.waitForSelector('.ProseMirror')
  await page.waitForTimeout(700)
  check('session survives reload', (await page.getByRole('button', { name: /account menu/ }).count()) === 1)
  check('account history survives reload', (await page.getByRole('button', { name: /History, 1 saved brief/ }).count()) === 1)

  await fillEditor(page, 0, 'Ship the account history feature v2')
  let failures = 0
  await page.route('**/api/history', async (route) => {
    if (route.request().method() === 'POST' && failures < 2) {
      failures += 1
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Starting', code: 'db_unavailable' }),
      })
      return
    }
    await route.continue()
  })
  await page.getByRole('button', { name: 'Save brief' }).click()
  await page.waitForTimeout(900)
  const wakingToast = await page.getByRole('status').innerText()
  check('retry surfaces the waking state', wakingToast.includes('waking'), wakingToast)
  await page.waitForFunction(
    () => document.querySelector('[role="status"]')?.textContent?.includes('Saved to history'),
    undefined,
    { timeout: 20000 },
  )
  check('save succeeds after two 503 responses', failures === 2, failures)
  check('retried save added an entry', (await page.getByRole('button', { name: /History, 2 saved briefs/ }).count()) === 1)
  await page.unroute('**/api/history')

  await page.getByRole('button', { name: `${emailA} account menu` }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Sign in' }).click()
  const authDialog = page.getByRole('dialog')
  await authDialog.getByRole('tab', { name: 'Create account' }).click()
  await authDialog.getByLabel('Email').fill('demo@example.test')
  await authDialog.getByLabel('Password').fill('demo-password')
  await page.screenshot({ path: `${SHOTS}/desktop-auth.png` })
  await page.getByRole('button', { name: 'Close sign in' }).click()

  await page.getByRole('button', { name: 'Dark theme' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${SHOTS}/desktop-dark-auth.png` })
  await page.getByRole('button', { name: 'Close sign in' }).click()

  await page.getByRole('button', { name: 'Light theme' }).click()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('no horizontal overflow at 1440', overflow <= 0, overflow)

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const mobilePage = await mobile.newPage()
  mobilePage.on('pageerror', (error) => consoleErrors.push(`MOBILE ${error.message}`))
  await mobilePage.goto(BASE_URL)
  await mobilePage.waitForSelector('.ProseMirror')
  const mobileOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('no horizontal overflow at 390', mobileOverflow <= 0, mobileOverflow)
  check('mobile status stays available', (await mobilePage.getByRole('button', { name: 'Server online' }).count()) === 1)
  await mobilePage.getByRole('button', { name: 'Sign in' }).click()
  await mobilePage.waitForTimeout(250)
  await mobilePage.screenshot({ path: `${SHOTS}/mobile-auth.png` })
  await mobilePage.getByRole('button', { name: 'Close sign in' }).click()
  await mobilePage.screenshot({ path: `${SHOTS}/mobile-account.png`, fullPage: true })

  const unexpected = consoleErrors.filter((message) => !message.includes('503'))
  check('no unexpected console errors', unexpected.length === 0, unexpected.join(' | '))

  await browser.close()
  console.log(JSON.stringify({ passed: results.length, results, consoleErrors }, null, 2))
})().catch((error) => {
  console.error(error.message)
  console.error(JSON.stringify({ results }, null, 2))
  process.exit(1)
})
