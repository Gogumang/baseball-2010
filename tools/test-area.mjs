// **단위 시험 골라 돌리기** (`yarn test:area`) — 도메인(`e2e/areas/<도메인>.mjs` 의 `sources` 경로 머리)이나 바뀐 파일로 vitest 파일을 고른다.
// 워커 2 (기계를 나눠 쓴다). 긴 soak(careerSoak · pitcherLeagueSoak)는 `test:quick` 처럼 뺀다. 끝에 CPU 초 합 · 최대 RSS 를 찍는다.
//
//   yarn test:area nari                 # 도메인 하나 (쉼표로 여럿)
//   yarn test:area --changed            # main 과 갈라진 뒤 바뀐 파일(+ 커밋 안 한 것)의 폴더에 있는 시험 (--changed=<기준>)
//   yarn test:area --list               # 도메인과 경로 머리
//   yarn test:area nari -- -t '휴식'    # `--` 뒤는 vitest 에 그대로
import { spawn } from 'node:child_process'
import { dirname } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const { AREAS } = await import(`${ROOT}e2e/lib/catalog.mjs`)
const { formatUsage, startUsageMeter } = await import(`${ROOT}e2e/lib/usage.mjs`)

const argv = process.argv.slice(2)
const passIndex = argv.indexOf('--')
const own = passIndex === -1 ? argv : argv.slice(0, passIndex)
const passThrough = passIndex === -1 ? [] : argv.slice(passIndex + 1)

if (own.includes('--list') || own.length === 0) {
  for (const [name, area] of Object.entries(AREAS)) console.log(`${name.padEnd(15)} ${area.sources.filter((path) => path.startsWith('src/')).join(' ')}`)
  if (own.length === 0) console.log('\n쓰는 법: yarn test:area <도메인[,도메인]> | --changed[=<기준>] [-- <vitest 인자>]')
  process.exit(own.length === 0 ? 2 : 0)
}

const filters = new Set()
const changedArg = own.find((arg) => arg === '--changed' || arg.startsWith('--changed='))
if (changedArg !== undefined) {
  const { areasOfChanges, changedFiles } = await import(`${ROOT}e2e/lib/changed.mjs`)
  const files = changedFiles(changedArg.split('=')[1])
  const { areas } = areasOfChanges(files)
  // 시험은 코드 옆에 있다 — 바뀐 src 파일의 폴더
  for (const file of files) if (file.startsWith('src/')) filters.add(`${dirname(file)}/`)
  console.log(`바뀐 파일 ${files.length} → 폴더 ${filters.size} (도메인 ${areas.join(' · ') || '없음'} — e2e 는 yarn e2e:only --changed)`)
}
for (const name of own.filter((arg) => !arg.startsWith('--')).flatMap((arg) => arg.split(','))) {
  const area = AREAS[name]
  if (area === undefined) throw new Error(`도메인이 없다: ${name} (있는 것: ${Object.keys(AREAS).join(', ')})`)
  for (const path of area.sources) if (path.startsWith('src/')) filters.add(path)
}
if (filters.size === 0) {
  console.log('고른 시험 파일 없음')
  process.exit(0)
}

const workers = Math.min(2, Number(process.env.TEST_AREA_WORKERS ?? 2))
const args = ['vitest', 'run', `--maxWorkers=${workers}`, '--passWithNoTests',
  '--exclude', 'src/app/model/soak/careerSoak.test.tsx', '--exclude', 'src/app/model/soak/pitcherLeagueSoak.test.tsx', ...passThrough, ...filters]
console.log(`yarn ${args.join(' ')}`)
const started = Date.now()
const meter = startUsageMeter()
const child = spawn('yarn', args, { cwd: ROOT, stdio: 'inherit' })
const code = await new Promise((resolve) => child.on('exit', (exitCode) => resolve(exitCode ?? 1)))
console.log(formatUsage(await meter.stop(), { wallMs: Date.now() - started }))
process.exit(code)
