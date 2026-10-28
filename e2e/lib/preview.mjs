// e2e 빌드(`vite build --mode e2e`) → preview 를 띄우고 끄는 도우미 — `e2e/quick.mjs` · `e2e/only.mjs` · `e2e/snapshot.mjs` 가 쓴다.
// 빌드 산출물이 입력(src · public · 픽스처 · 스냅샷 · 설정)보다 새것이면 다시 묶지 않는다(`E2E_REBUILD=1` 이면 늘 묶는다).
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../..', import.meta.url).pathname
const INPUT_DIRS = ['src', 'public', 'e2e/fixtures', 'e2e/snapshots', 'tools']
const INPUT_FILES = ['index.html', 'vite.config.ts', 'package.json', 'yarn.lock']

const viteArgs = () => {
  const bin = execFileSync('yarn', ['bin', 'vite'], { cwd: ROOT, encoding: 'utf8' }).trim()
  return ['--require', './.pnp.cjs', '--loader', './.pnp.loader.mjs', '--no-warnings', bin]
}

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

async function waitUp(url, child) {
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error(`preview 가 끝났다 (끝 코드 ${child.exitCode})`)
    try {
      if ((await fetch(url)).ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`preview 가 ${url} 에 안 떴다`)
}

/** 자식 프로세스로 빌드 — 비동기라 자원 재기(`usage.mjs`)가 그동안도 뜬다 */
function build(node, outDir) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [...node, 'build', '--mode', 'e2e', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], { cwd: ROOT, stdio: 'pipe' })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    child.on('exit', (code) => {
      if (code === 0) return resolve()
      process.stderr.write(output)
      reject(new Error('e2e 빌드 실패'))
    })
  })
}

/** e2e 빌드를 `e2e/.run/<dir>` 에 묶고(낡았을 때만) preview 를 `port` 에 띄운다 — `{ url, stop, buildMs, reused }` */
export async function startE2ePreview({ port, dir, reuse = process.env.E2E_REBUILD !== '1' }) {
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
  const child = spawn('node', [...node, 'preview', '--mode', 'e2e', '--outDir', outDir, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  })
  const url = `http://127.0.0.1:${port}/`
  await waitUp(url, child)
  return { url, stop: () => child.kill(), buildMs, reused }
}
