// **단위 시험 골라 돌리기** (`pnpm test:area`) — 도메인(`tools/testAreas.mjs` 의 경로 머리)이나 바뀐 파일로 vitest 파일을 고른다.
// 워커 2 (기계를 나눠 쓴다). 끝에 걸린 시간을 찍는다.
//
//   pnpm test:area nari                 # 도메인 하나 (쉼표로 여럿)
//   pnpm test:area --changed            # main 과 갈라진 뒤 바뀐 파일(+ 커밋 안 한 것)의 폴더에 있는 시험 (--changed=<기준>)
//   pnpm test:area --list               # 도메인과 경로 머리
//   pnpm test:area nari -- -t '휴식'    # `--` 뒤는 vitest 에 그대로
import { execFileSync, spawn } from 'node:child_process'
import { dirname } from 'node:path'
import { TEST_AREAS } from './testAreas.mjs'

const ROOT = new URL('..', import.meta.url).pathname

const argv = process.argv.slice(2)
const passIndex = argv.indexOf('--')
const own = passIndex === -1 ? argv : argv.slice(0, passIndex)
const passThrough = passIndex === -1 ? [] : argv.slice(passIndex + 1)

if (own.includes('--list') || own.length === 0) {
  for (const [name, sources] of Object.entries(TEST_AREAS)) console.log(`${name.padEnd(15)} ${sources.join(' ')}`)
  if (own.length === 0) console.log('\n쓰는 법: pnpm test:area <도메인[,도메인]> | --changed[=<기준>] [-- <vitest 인자>]')
  process.exit(own.length === 0 ? 2 : 0)
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)

/** 바뀐 파일 = `<기준>...HEAD`(기준 기본: main 과 갈라진 곳) + 아직 커밋 안 한 것(추적 안 하는 새 파일 포함) */
function changedFiles(base) {
  const from = base ?? git('merge-base', 'HEAD', 'main')[0]
  const committed = git('diff', '--name-only', `${from}...HEAD`)
  const working = git('status', '--porcelain', '--untracked-files=all').map((line) => line.slice(3).replace(/^.* -> /, ''))
  return [...new Set([...committed, ...working])].sort()
}

const filters = new Set()
const changedArg = own.find((arg) => arg === '--changed' || arg.startsWith('--changed='))
if (changedArg !== undefined) {
  const files = changedFiles(changedArg.split('=')[1])
  // 시험은 코드 옆에 있다 — 바뀐 src 파일의 폴더
  for (const file of files) if (file.startsWith('src/')) filters.add(`${dirname(file)}/`)
  console.log(`바뀐 파일 ${files.length} → 폴더 ${filters.size}`)
}
for (const name of own.filter((arg) => !arg.startsWith('--')).flatMap((arg) => arg.split(','))) {
  const sources = TEST_AREAS[name]
  if (sources === undefined) throw new Error(`도메인이 없다: ${name} (있는 것: ${Object.keys(TEST_AREAS).join(', ')})`)
  for (const path of sources) filters.add(path)
}
if (filters.size === 0) {
  console.log('고른 시험 파일 없음')
  process.exit(0)
}

const workers = Math.min(2, Number(process.env.TEST_AREA_WORKERS ?? 2))
const args = ['exec', 'vitest', 'run', `--maxWorkers=${workers}`, '--passWithNoTests', ...passThrough, ...filters]
console.log(`pnpm ${args.join(' ')}`)
const started = Date.now()
const child = spawn('pnpm', args, { cwd: ROOT, stdio: 'inherit' })
const code = await new Promise((resolve) => child.on('exit', (exitCode) => resolve(exitCode ?? 1)))
console.log(`벽시계 ${((Date.now() - started) / 1000).toFixed(1)}s`)
process.exit(code)
