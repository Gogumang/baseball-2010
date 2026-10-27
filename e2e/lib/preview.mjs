// e2e 빌드(`vite build --mode e2e`) → preview 를 띄우고 끄는 도우미 — `e2e/quick.mjs` · `e2e/snapshot.mjs` 가 쓴다.
import { execFileSync, spawn } from 'node:child_process'
import { join } from 'node:path'

const ROOT = new URL('../..', import.meta.url).pathname

const viteArgs = () => {
  const bin = execFileSync('yarn', ['bin', 'vite'], { cwd: ROOT, encoding: 'utf8' }).trim()
  return ['--require', './.pnp.cjs', '--loader', './.pnp.loader.mjs', '--no-warnings', bin]
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

/** e2e 빌드를 `e2e/.run/<dir>` 에 묶고 preview 를 `port` 에 띄운다 — `{ url, stop, buildMs }` */
export async function startE2ePreview({ port, dir }) {
  const outDir = join(ROOT, 'e2e/.run', dir)
  const node = viteArgs()
  const buildStarted = Date.now()
  try {
    execFileSync('node', [...node, 'build', '--mode', 'e2e', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], { cwd: ROOT, stdio: 'pipe' })
  } catch (error) {
    process.stderr.write(`${error.stdout ?? ''}${error.stderr ?? ''}`)
    throw new Error('e2e 빌드 실패')
  }
  const buildMs = Date.now() - buildStarted
  const child = spawn('node', [...node, 'preview', '--mode', 'e2e', '--outDir', outDir, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  })
  const url = `http://127.0.0.1:${port}/`
  await waitUp(url, child)
  return { url, stop: () => child.kill(), buildMs }
}
