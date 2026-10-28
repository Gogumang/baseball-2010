// **명령 하나의 자원 재기** — 명령을 띄우고 그 나무의 CPU 초 합 · 최대 RSS · 최대 동시 브라우저 수 · 벽시계를 찍는다(`lib/usage.mjs`).
// 옛 길과 새 길을 같은 자로 견줄 때 쓴다.
//
//   pnpm e2e:measure pnpm e2e:quick nari-outing
//   pnpm e2e:measure pnpm vitest run --maxWorkers=2 src/entities/career
import { spawn } from 'node:child_process'
import { formatUsage, startUsageMeter } from './lib/usage.mjs'

const [command, ...args] = process.argv.slice(2)
if (command === undefined) {
  console.error('쓰는 법: pnpm e2e:measure <명령> [인자…]')
  process.exit(2)
}
const started = Date.now()
const meter = startUsageMeter()
const child = spawn(command, args, { stdio: 'inherit' })
const code = await new Promise((resolve) => child.on('exit', (exitCode) => resolve(exitCode ?? 1)))
const usage = await meter.stop()
console.log(`\n[measure] ${[command, ...args].join(' ')} → 끝 코드 ${code}`)
console.log(`[measure] ${formatUsage(usage, { wallMs: Date.now() - started })}`)
process.exit(code)
