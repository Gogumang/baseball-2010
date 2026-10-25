// **전체 회귀** — 화면 확인을 한 번에 돌리고 요약을 낸다 (`yarn e2e:all`).
//
//   yarn e2e:all                              # 개발 서버 · `--mode e2e` 빌드 양쪽 (약 30분)
//   E2E_ALL_TARGETS=e2e yarn e2e:all          # 한쪽만 (dev · e2e, 쉼표)
//   E2E_ALL_SKIP=perf,hits yarn e2e:all       # 빼기 (smoke · hits · browser · fixtures · perf · leak)
//   E2E_ALL_PORT=5640 yarn e2e:all            # 포트 바닥 — 개발 서버 +0 · e2e 빌드 +1 · 배포 빌드(perf 켤 때 길) +2
//
// 차례:
//  1. smoke — 장면 표 전부 × chromium · webkit (`e2e/smoke.mjs`), 대상마다. 대상끼리는 함께 돈다
//  2. hits — 누름 칸 맞음 검사 (`e2e/hits.mjs`), 대상마다 차례로(보고 파일이 하나라서). 보고는 `e2e/.run/hits-report-<대상>.json`
//  3. browser — `yarn test:browser`
//  4. fixtures — `SOAK_FIXTURE_DRY=1 yarn e2e:fixtures` (soak 픽스처가 지금 저장 꼴로 여전히 같은 자리에 닿는지, 안 쓴다)
//  5. perf — 느린 4G 첫 진입 (`e2e/perf.mjs`, 실행 1번). 숫자만 — 실패로 치지 않는다(쪽 오류 · 끝 코드만 본다)
//  6. leak — 배포 빌드(`vite build`)에 장면 바로가기가 안 들어갔는지 grep
//
// 서버는 이미 떠 있으면 그대로 쓰고, 이 스크립트가 띄운 것만 pid 로 끈다. 요약은 끝에 찍고 `e2e/.run/all-report.json` 에도 둔다.
// 하나라도 실패하면 끝 코드 1.
import { execFileSync, spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const RUN = join(ROOT, 'e2e/.run')
const BASE_PORT = Number(process.env.E2E_ALL_PORT ?? 5640)
const TARGETS = (process.env.E2E_ALL_TARGETS ?? 'dev,e2e').split(',').filter(Boolean)
const SKIP = new Set((process.env.E2E_ALL_SKIP ?? '').split(',').filter(Boolean))
const PORTS = { dev: BASE_PORT, e2e: BASE_PORT + 1, deploy: BASE_PORT + 2 }

/** README 「배포 빌드에 안 들어가는지」 와 같은 낱말 */
const LEAK_PATTERN =
  '__sceneProbe|sceneRunner|nari-y1|nari-burst|PTEST|pitcher-defense|mission-result|general-relay|isPitchSlotPickerShown|isAutoRelay|season-cup|STEST|season-ending|nari-hall-of-fame|pitcher-cup-result|soakFixtures|SOAK'

mkdirSync(RUN, { recursive: true })
const ownedServers = []

function serve(port, mode) {
  const env = { ...process.env, E2E_PORT: String(port) }
  try {
    execFileSync('e2e/serve.sh', ['status'], { cwd: ROOT, env, stdio: 'ignore' })
    console.log(`[서버] ${port} 이미 떠 있음 — 그대로 쓴다`)
    return
  } catch {
    execFileSync('e2e/serve.sh', [mode], { cwd: ROOT, env, stdio: 'inherit' })
    ownedServers.push(() => execFileSync('e2e/serve.sh', ['stop'], { cwd: ROOT, env, stdio: 'inherit' }))
  }
}

/** 배포 빌드(바로가기 없음) + preview — perf 의 켤 때 길 · leak 검사에 쓴다 */
async function serveDeploy() {
  const outDir = join(RUN, 'dist-deploy')
  const vite = execFileSync('yarn', ['bin', 'vite'], { cwd: ROOT, encoding: 'utf8' }).trim()
  const node = ['--require', './.pnp.cjs', '--loader', './.pnp.loader.mjs', '--no-warnings', vite]
  execFileSync('node', [...node, 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn'], { cwd: ROOT, stdio: 'inherit' })
  if (SKIP.has('perf')) return outDir
  const child = spawn('node', [...node, 'preview', '--outDir', outDir, '--host', '127.0.0.1', '--port', String(PORTS.deploy), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  })
  ownedServers.push(() => child.kill())
  for (let i = 0; i < 150; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORTS.deploy}/`)
      if (response.ok) return outDir
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`배포 빌드 preview 가 ${PORTS.deploy} 에 안 떴다`)
}

/** 명령 하나를 돌려 출력은 흘려 보내고 끝 코드 · 시간 · 출력을 모은다 */
function run(name, command, args, env = {}) {
  const started = Date.now()
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    const take = (chunk) => {
      const text = chunk.toString()
      output += text
      for (const line of text.split('\n')) if (line !== '') process.stdout.write(`[${name}] ${line}\n`)
    }
    child.stdout.on('data', take)
    child.stderr.on('data', take)
    child.on('close', (code) => resolve({ name, code, ms: Date.now() - started, output }))
  })
}

const lastMatch = (text, pattern) => [...text.matchAll(pattern)].at(-1)?.[0] ?? null

/** 단계마다 요약 한 줄 */
function summarize(step) {
  const out = step.output.replace(/\x1b\[[0-9;]*m/g, '')
  if (step.kind === 'smoke') return lastMatch(out, /\d+\/\d+ 통과[^\n]*/g) ?? '요약 줄 없음'
  if (step.kind === 'hits') {
    const allowed = lastMatch(out, /허용된 겹침 \d+건/g)
    const verdict = lastMatch(out, /(겹침 없음[^\n]*|실패 \d+[^\n]*)/g)
    return [verdict, allowed].filter(Boolean).join(' · ') || '요약 줄 없음'
  }
  if (step.kind === 'browser' || step.kind === 'fixtures') {
    const files = lastMatch(out, /Test Files[^\n]*/g)
    const tests = lastMatch(out, /Tests {2}[^\n]*/g)
    return [files, tests].filter(Boolean).map((line) => line.replace(/\s+/g, ' ').trim()).join(' · ') || '요약 줄 없음'
  }
  if (step.kind === 'perf') return out.split('\n').filter((line) => line.startsWith('|')).join('\n')
  if (step.kind === 'leak') return step.code === 0 ? 'clean' : step.output.trim()
  return ''
}

function grepLeak(dir) {
  const re = new RegExp(LEAK_PATTERN)
  const hits = []
  const walk = (path) => {
    for (const name of readdirSync(path)) {
      const full = join(path, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (re.test(readFileSync(full, 'latin1'))) hits.push(full.slice(ROOT.length))
    }
  }
  walk(dir)
  return { name: 'leak', kind: 'leak', code: hits.length === 0 ? 0 : 1, ms: 0, output: hits.join('\n') }
}

const started = Date.now()
const steps = []
try {
  if (TARGETS.includes('dev')) serve(PORTS.dev, 'dev')
  if (TARGETS.includes('e2e')) serve(PORTS.e2e, 'e2e')
  let deployDir = null
  if (!SKIP.has('perf') || !SKIP.has('leak')) deployDir = await serveDeploy()

  if (!SKIP.has('smoke')) {
    const smokes = await Promise.all(TARGETS.map((target) => run(`smoke:${target}`, 'yarn', ['node', 'e2e/smoke.mjs'], { E2E_PORT: String(PORTS[target]) })))
    steps.push(...smokes.map((step) => ({ ...step, kind: 'smoke' })))
  }
  if (!SKIP.has('hits')) {
    for (const target of TARGETS) {
      const step = await run(`hits:${target}`, 'yarn', ['node', 'e2e/hits.mjs'], { E2E_PORT: String(PORTS[target]) })
      if (existsSync(join(RUN, 'hits-report.json'))) copyFileSync(join(RUN, 'hits-report.json'), join(RUN, `hits-report-${target}.json`))
      steps.push({ ...step, kind: 'hits' })
    }
  }
  if (!SKIP.has('browser')) steps.push({ ...(await run('browser', 'yarn', ['test:browser'])), kind: 'browser' })
  if (!SKIP.has('fixtures')) steps.push({ ...(await run('fixtures', 'yarn', ['e2e:fixtures'], { SOAK_FIXTURE_DRY: '1' })), kind: 'fixtures' })
  if (!SKIP.has('perf')) {
    const port = TARGETS.includes('e2e') ? PORTS.e2e : PORTS.dev
    const step = await run('perf', 'yarn', ['node', 'e2e/perf.mjs'], {
      E2E_PORT: String(port),
      PERF_BOOT_URL: `http://127.0.0.1:${PORTS.deploy}/`,
      PERF_RUNS: process.env.PERF_RUNS ?? '1',
    })
    steps.push({ ...step, kind: 'perf' })
  }
  if (!SKIP.has('leak') && deployDir !== null) steps.push(grepLeak(deployDir))
} finally {
  for (const stop of ownedServers.reverse()) {
    try {
      stop()
    } catch {}
  }
}

const report = steps.map((step) => ({ name: step.name, ok: step.code === 0, code: step.code, seconds: Math.round(step.ms / 100) / 10, summary: summarize(step) }))
writeFileSync(join(RUN, 'all-report.json'), `${JSON.stringify({ seconds: Math.round((Date.now() - started) / 1000), steps: report }, null, 2)}\n`)
console.log(`\n전체 회귀 — ${((Date.now() - started) / 60000).toFixed(1)}분 (대상 ${TARGETS.join(' · ')})`)
for (const row of report) {
  const head = `  ${row.ok ? 'ok  ' : 'FAIL'} ${row.name.padEnd(10)} ${String(row.seconds).padStart(6)}s`
  if (row.summary.includes('\n')) console.log(`${head}\n${row.summary.split('\n').map((line) => `       ${line}`).join('\n')}`)
  else console.log(`${head}  ${row.summary}`)
}
process.exit(report.every((row) => row.ok) ? 0 : 1)
