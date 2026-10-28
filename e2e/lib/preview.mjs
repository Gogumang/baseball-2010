// e2e 빌드(`vite build --mode e2e`) → preview 를 띄우고 끄는 도우미 — `e2e/quick.mjs` · `e2e/only.mjs` · `e2e/snapshot.mjs` 가 쓴다.
// 빌드 산출물이 입력(src · public · 픽스처 · 스냅샷 · 설정)보다 새것이면 다시 묶지 않는다(`E2E_REBUILD=1` 이면 늘 묶는다).
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createServer } from 'node:net'

const ROOT = new URL('../..', import.meta.url).pathname
const INPUT_DIRS = ['src', 'public', 'e2e/fixtures', 'e2e/snapshots', 'tools']
const INPUT_FILES = ['index.html', 'vite.config.ts', 'package.json', 'pnpm-lock.yaml']

// pnpm 을 거치면 pnpm 이 vite 를 자식으로 띄워 pid 로 못 끈다 — node 로 vite 를 곧바로 띄운다
const viteArgs = () => [join(ROOT, 'node_modules/vite/bin/vite.js')]

/** 입력 가운데 가장 늦게 바뀐 시각(ms) */
function newestInput() {
  let newest = 0
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else newest = Math.max(newest, statSync(path).mtimeMs)
    }
  }
  for (const dir of INPUT_DIRS) if (existsSync(join(ROOT, dir))) walk(join(ROOT, dir))
  for (const file of INPUT_FILES) if (existsSync(join(ROOT, file))) newest = Math.max(newest, statSync(join(ROOT, file)).mtimeMs)
  return newest
}

/** `port` 를 지금 아무도 안 쓰면 참 (127.0.0.1) */
function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = createServer()
    probe.once('error', () => resolve(false))
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)))
  })
}

/**
 * 띄울 포트 — 바란 포트가 비었으면 그것, 아니면 운영체제가 고른 빈 포트(r355). 포트를 고정하면 다른 워크트리 · 에이전트의 preview 와
 * 겹친다: `--strictPort` 인 우리 preview 는 곧 죽지만 `waitUp` 은 남의 서버가 대답해 "떴다" 로 보고, 남의 빌드를 시험하다 그쪽이
 * 꺼지면 "Could not connect to the server" 가 났다
 */
export async function choosePreviewPort(wanted) {
  if (await isPortFree(wanted)) return wanted
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

/** 우리 preview(자식)가 그 주소에서 듣기 시작했다고 알리고(표준 출력의 주소) 대답할 때까지 — 남의 서버 대답은 믿지 않는다 */
async function waitUp(url, child, output) {
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error(`preview 가 끝났다 (끝 코드 ${child.exitCode}): ${output.text.slice(-300)}`)
    if (output.text.includes(url.replace(/\/$/, ''))) {
      try {
        if ((await fetch(url)).ok) return
      } catch {}
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`preview 가 ${url} 에 안 떴다`)
}

/** 자식 프로세스로 빌드 — 비동기라 자원 재기(`usage.mjs`)가 그동안도 뜬다 */
function build(node, outDir) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [...node, 'build', '--mode', 'e2e', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], {
      cwd: ROOT,
      stdio: 'pipe',
    })
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk
    })
    child.stderr.on('data', (chunk) => {
      output += chunk
    })
    child.on('exit', (code) => {
      if (code === 0) return resolve()
      process.stderr.write(output)
      reject(new Error('e2e 빌드 실패'))
    })
  })
}

/** e2e 빌드를 `e2e/.run/<dir>` 에 묶고(낡았을 때만) preview 를 `port`(쓰이고 있으면 빈 포트)에 띄운다 — `{ url, port, stop, buildMs, reused }` */
export async function startE2ePreview({ port, dir, reuse = process.env.E2E_REBUILD !== '1', exactPort = false }) {
  const outDir = join(ROOT, 'e2e/.run', dir)
  const stampFile = `${outDir}.stamp.json`
  const node = viteArgs()
  const newest = newestInput()
  const stamp = existsSync(stampFile) ? JSON.parse(readFileSync(stampFile, 'utf8')) : null
  const reused = reuse && stamp !== null && stamp.newest >= newest && existsSync(join(outDir, 'index.html'))
  const buildStarted = Date.now()
  if (!reused) {
    await build(node, outDir)
    writeFileSync(stampFile, `${JSON.stringify({ newest, builtAt: new Date().toISOString() })}\n`)
  }
  const buildMs = Date.now() - buildStarted
  // `exactPort` — 부르는 쪽이 이미 그 주소를 굳혔다(`choosePreviewPort` 로 고른 뒤 E2E_URL) — 그새 누가 잡았으면 바꾸지 않고 실패
  const chosen = exactPort ? port : await choosePreviewPort(port)
  if (chosen !== port) console.log(`포트 ${port} 를 다른 것이 쓰고 있어 ${chosen} 에 띄운다`)
  const child = spawn(
    'node',
    [...node, 'preview', '--mode', 'e2e', '--outDir', outDir, '--host', '127.0.0.1', '--port', String(chosen), '--strictPort'],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  // 출력은 끝까지 비운다(파이프가 차면 preview 가 멈춘다) — 주소 줄 · 오류만 본다
  const output = { text: '' }
  const keep = (chunk) => {
    output.text = (output.text + chunk).slice(-4000)
  }
  child.stdout.on('data', keep)
  child.stderr.on('data', keep)
  const url = `http://127.0.0.1:${chosen}/`
  await waitUp(url, child, output).catch((error) => {
    child.kill()
    throw error
  })
  return { url, port: chosen, stop: () => child.kill(), buildMs, reused }
}
