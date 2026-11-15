const BASE_URL = process.env.API_URL || 'http://localhost:8787'

const results = []

function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail })
  if (!condition) throw new Error(`FAIL ${name}: ${detail ?? ''}`)
}

function doc(text) {
  return {
    type: 'doc',
    content: text
      ? [{ type: 'paragraph', content: [{ type: 'text', text }] }]
      : [{ type: 'paragraph' }],
  }
}

function docs(goal) {
  return { goal: doc(goal), constraints: doc(''), files: doc(''), questions: doc('') }
}

async function request(path, { method = 'GET', body, cookie, origin = BASE_URL } = {}) {
  const headers = {}
  if (origin) headers.origin = origin
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (cookie) headers.cookie = cookie

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  const setCookie = response.headers.getSetCookie?.() ?? []
  const session = setCookie
    .map((value) => value.split(';')[0])
    .find((value) => value.startsWith('ps_session='))

  return { status: response.status, data, session, setCookie }
}

function randomEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`
}

;(async () => {
  const ping = await request('/api/ping')
  check('ping responds 200', ping.status === 200 && ping.data?.ok === true)

  const health = await request('/api/health')
  check('health reports a connected database', health.data?.db === 'connected', health.data)

  const emailA = randomEmail('alice')
  const emailB = randomEmail('bob')
  const password = 'correct-horse-battery'

  const signupA = await request('/api/auth/signup', { method: 'POST', body: { email: emailA, password } })
  check('signup returns 201', signupA.status === 201, signupA.data)
  check('signup sets an httpOnly cookie', signupA.setCookie.some((value) => /HttpOnly/i.test(value)))
  check('signup returns the user', signupA.data?.user?.email === emailA)
  const cookieA = signupA.session

  const meA = await request('/api/auth/me', { cookie: cookieA })
  check('me returns the signed-in user', meA.data?.user?.email === emailA)

  const guestMe = await request('/api/auth/me')
  check('me returns null for a guest', guestMe.status === 200 && guestMe.data?.user === null)

  const invalidDocs = await request('/api/history', {
    method: 'POST',
    cookie: cookieA,
    body: { docs: { goal: { type: 'paragraph' } } },
  })
  check('invalid docs are rejected', invalidDocs.status === 400, invalidDocs.data)

  const invalidSettings = await request('/api/history', {
    method: 'POST',
    cookie: cookieA,
    body: { docs: docs('Ship the settings page'), settings: { kind: 'task', directives: [] } },
  })
  check('invalid settings are rejected', invalidSettings.status === 400, invalidSettings.data)

  const settings = { kind: 'bug', directives: ['plan'] }

  const saved = await request('/api/history', {
    method: 'POST',
    cookie: cookieA,
    body: { docs: docs('Ship the settings page'), settings },
  })
  check('save returns an entry', saved.status === 200 && saved.data?.entry?.docs?.goal, saved.data)
  check('entry keeps its settings', JSON.stringify(saved.data?.entry?.settings) === JSON.stringify(settings), saved.data?.entry?.settings)
  check('first save is not a duplicate', saved.data?.duplicate === false)
  const entryId = saved.data?.entry?.id
  check('entry has an id and timestamp', typeof entryId === 'string' && typeof saved.data?.entry?.savedAt === 'number')

  const duplicate = await request('/api/history', {
    method: 'POST',
    cookie: cookieA,
    body: { docs: docs('Ship the settings page'), settings },
  })
  check('second identical save reports duplicate', duplicate.data?.duplicate === true)
  check('duplicate returns the same entry', duplicate.data?.entry?.id === entryId)

  const listA = await request('/api/history', { cookie: cookieA })
  check('user A sees one entry', listA.data?.entries?.length === 1, listA.data)

  const signupB = await request('/api/auth/signup', { method: 'POST', body: { email: emailB, password } })
  check('second signup returns 201', signupB.status === 201, signupB.data)
  const cookieB = signupB.session

  const listB = await request('/api/history', { cookie: cookieB })
  check('user B starts with empty history', listB.data?.entries?.length === 0, listB.data)

  const crossDelete = await request(`/api/history/${entryId}`, { method: 'DELETE', cookie: cookieB })
  check("user B cannot delete user A's entry", crossDelete.status === 404, crossDelete.status)

  const missingAuth = await request('/api/history')
  check('history requires a session', missingAuth.status === 401, missingAuth.status)

  const clearB = await request('/api/history', { method: 'DELETE', cookie: cookieB })
  check('clear for user B is a no-op 204', clearB.status === 204)

  const listAAfterClearB = await request('/api/history', { cookie: cookieA })
  check("user B's clear leaves user A's entry", listAAfterClearB.data?.entries?.length === 1)

  const deleted = await request(`/api/history/${entryId}`, { method: 'DELETE', cookie: cookieA })
  check('owner can delete the entry', deleted.status === 204, deleted.status)

  const listAAfterDelete = await request('/api/history', { cookie: cookieA })
  check('history is empty after delete', listAAfterDelete.data?.entries?.length === 0)

  await request('/api/history', { method: 'POST', cookie: cookieA, body: { docs: docs('Clear me') } })
  const cleared = await request('/api/history', { method: 'DELETE', cookie: cookieA })
  check('owner can clear all entries', cleared.status === 204)
  const listAAfterClear = await request('/api/history', { cookie: cookieA })
  check('clear empties history', listAAfterClear.data?.entries?.length === 0)

  const logout = await request('/api/auth/logout', { method: 'POST', cookie: cookieA })
  check('logout returns 204', logout.status === 204)
  const meAfterLogout = await request('/api/auth/me', { cookie: cookieA })
  check('session is revoked after logout', meAfterLogout.data?.user === null)

  const badLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: emailA, password: 'wrong-password' },
  })
  check('wrong password is rejected', badLogin.status === 401, badLogin.data)

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: emailA, password },
  })
  check('correct password signs in', login.status === 200 && login.data?.user?.email === emailA)
  check('login issues a fresh session', Boolean(login.session))

  const forbiddenOrigin = await request('/api/auth/login', {
    method: 'POST',
    origin: 'https://evil.example',
    body: { email: emailA, password },
  })
  check('disallowed origin is rejected', forbiddenOrigin.status === 403, forbiddenOrigin.status)

  const missingOrigin = await request('/api/auth/logout', { method: 'POST', origin: '' })
  check('unsafe requests without an origin are rejected', missingOrigin.status === 403, missingOrigin.status)

  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch((error) => {
  console.error(error.message)
  console.error(JSON.stringify({ results }, null, 2))
  process.exit(1)
})
