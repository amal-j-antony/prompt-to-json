import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'

const WEB_PORT = 5173
const API_PORT = 8787
const PROBE_TIMEOUT = 750
const START_GRACE = 10_000
const PROBE_INTERVAL = 5_000
const MAX_FAILURES = 2
const DETACHED = process.platform !== 'win32'
const EXECUTABLE = process.platform === 'win32' ? '.cmd' : ''
const VITE_BIN = path.resolve('node_modules', '.bin', `vite${EXECUTABLE}`)
const TSX_BIN = path.resolve('node_modules', '.bin', `tsx${EXECUTABLE}`)

let web = null
let api = null
let stopping = false
let apiStartedAt = 0
let failures = 0
let probeBusy = false
let restarting = false

function probe(port, host) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host })
    let settled = false
    const finish = (open) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(open)
    }
    socket.setTimeout(PROBE_TIMEOUT, () => finish(false))
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
  })
}

async function portInUse(port) {
  return (await probe(port, '127.0.0.1')) || (await probe(port, '::1'))
}

function killTree(child, signal = 'SIGTERM') {
  if (!child?.pid) return
  if (!DETACHED) {
    child.kill(signal)
    return
  }
  try {
    process.kill(-child.pid, signal)
  } catch {
    try {
      child.kill(signal)
    } catch {
      return
    }
  }
}

function startWeb() {
  web = spawn(VITE_BIN, [], {
    stdio: 'inherit',
    detached: DETACHED,
    shell: process.platform === 'win32',
  })
  web.on('exit', (code) => {
    if (stopping) return
    console.error(`[dev] web exited with code ${code ?? 0}`)
    stop(code ?? 1)
  })
}

function startApi() {
  apiStartedAt = Date.now()
  failures = 0
  restarting = false
  api = spawn(TSX_BIN, ['watch', 'server/index.ts'], {
    stdio: 'inherit',
    detached: DETACHED,
    shell: process.platform === 'win32',
  })
  api.on('exit', (code) => {
    if (stopping) return
    console.error(`[dev] api supervisor exited with code ${code ?? 0}; restarting in 2s`)
    api = null
    setTimeout(() => {
      if (!stopping) startApi()
    }, 2000)
  })
}

function stop(code = 0) {
  if (stopping) return
  stopping = true
  killTree(web)
  killTree(api)
  setTimeout(() => {
    killTree(web, 'SIGKILL')
    killTree(api, 'SIGKILL')
    process.exit(code)
  }, 500)
}

async function monitor() {
  if (stopping || probeBusy || !api || restarting) return
  if (Date.now() - apiStartedAt < START_GRACE) return
  probeBusy = true
  try {
    if (await portInUse(API_PORT)) {
      failures = 0
      return
    }
    failures += 1
    console.warn(`[dev] api is not listening on :${API_PORT} (${failures}/${MAX_FAILURES})`)
    if (failures < MAX_FAILURES) return
    failures = 0
    restarting = true
    const target = api
    console.warn('[dev] restarting the api supervisor')
    killTree(target)
    setTimeout(() => {
      if (stopping || api !== target) return
      killTree(target, 'SIGKILL')
      setTimeout(() => {
        if (stopping || api !== target) return
        api = null
        startApi()
      }, 300)
    }, 2000)
  } finally {
    probeBusy = false
  }
}

async function main() {
  if (await portInUse(WEB_PORT)) {
    console.error(`[dev] port ${WEB_PORT} is already in use. Stop the other dev server first.`)
    process.exit(1)
  }
  if (await portInUse(API_PORT)) {
    console.error(`[dev] port ${API_PORT} is already in use. Stop the other dev server first.`)
    process.exit(1)
  }

  startWeb()
  startApi()
  setInterval(() => {
    void monitor()
  }, PROBE_INTERVAL)
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
void main()
