// 바뀐 파일 → 도메인 — `yarn e2e:only --changed` · `yarn test:area --changed` 가 쓴다.
// 바뀐 파일 = `<기준>...HEAD`(기준 기본: main 과 갈라진 곳) + 아직 커밋 안 한 것(추적 안 하는 새 파일 포함).
import { execFileSync } from 'node:child_process'
import { areasOfFile } from './catalog.mjs'

const ROOT = new URL('../..', import.meta.url).pathname
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)

/** 바뀐 파일 (저장소 뿌리에서의 경로) */
export function changedFiles(base) {
  const from = base ?? git('merge-base', 'HEAD', 'main')[0]
  const committed = git('diff', '--name-only', `${from}...HEAD`)
  const working = git('status', '--porcelain', '--untracked-files=all').map((line) => line.slice(3).replace(/^.* -> /, ''))
  return [...new Set([...committed, ...working])].sort()
}

/** 앱 · 시험 바탕에 닿는 파일인데 도메인이 없는 것 — 넓은 변경으로 본다 */
const isBroad = (file) =>
  (/^src\//.test(file) && !/\.test\.tsx?$/.test(file)) ||
  /^e2e\/lib\//.test(file) ||
  /^(vite\.config\.ts|package\.json|yarn\.lock|index\.html)$/.test(file)

/**
 * 바뀐 파일들 → `{ byFile: [[파일, 도메인들]], areas, broad }`. `broad` 는 도메인이 없는 앱 · 시험 바탕 파일 —
 * e2e 는 그때 도메인마다 대표 장면 하나씩을 더 본다
 */
export function areasOfChanges(files) {
  const byFile = files.map((file) => [file, areasOfFile(file)])
  const areas = [...new Set(byFile.flatMap(([, list]) => list))].sort()
  const broad = byFile.filter(([file, list]) => list.length === 0 && isBroad(file)).map(([file]) => file)
  return { byFile, areas, broad }
}
