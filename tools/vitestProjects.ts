import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * **단위 시험을 두 무리로** (r364) — 시험 파일마다 모듈을 새로 읽는 격리(`isolate`)가 전체 시간의 절반을 넘게 먹었다
 * (화면 시험 84s → 30s, 순수 시험 55s → 22s, `--maxWorkers=2`, 잴 때는 jsdom). 그래서 대부분은 한 워커 안에서 읽은 모듈을 나눠 쓰고
 * (`shared`), 다른 파일과 모듈을 나누면 깨지는 것만 예전처럼 격리한다(`isolated`).
 *
 * 격리하는 것:
 * - 모듈 바꿔치기(`vi.mock` 등)를 쓰는 시험 — 이미 읽힌 모듈에는 바꿔치기가 안 먹고, 바꿔친 모듈이 다음 파일에 남는다.
 * - `ISOLATED_TEST_FILES` — 바꿔치기는 없지만 모듈 전역 상태(한 번만 도는 연출 · 화면 뿌리 등)를 앞 파일과 나누면 깨지는 것.
 *
 * 새 시험이 `shared` 에서만 깨지면(혼자 돌리면 통과) 모듈 상태를 시험 안에서 되돌리거나 아래 목록에 이유와 함께 더한다.
 */
const MOCKS_MODULES = /\bvi\.(mock|doMock|unmock|doUnmock)\(/

/** 바꿔치기 없이도 격리가 필요한 시험 — 경로 알파벳 순 */
const ISOLATED_TEST_FILES: readonly string[] = [
  // 격리를 끈 무리에서 가끔(실행 차례에 따라) `#root` 에 쓴 style.transform 이 비어 깨진다 — 혼자 · 격리하면 늘 통과(원인 못 찾음, r364)
  'src/shared/lib/screenShake/useWholeScreenOffset.test.ts',
]

/** 머리에 DOM 환경(happy-dom)을 적은 시험 */
const DOM_ENVIRONMENT = /^\/\/ @vitest-environment happy-dom$/m
const TEST_FILE = /\.test\.tsx?$/

export interface UnitTestGroups {
  /** DOM 시험(happy-dom) — 격리 끔 */
  readonly dom: readonly string[]
  /** 격리해서 돌릴 시험 — 모듈 바꿔치기 · `ISOLATED_TEST_FILES` */
  readonly isolated: readonly string[]
}

/**
 * `src` 아래 단위 시험(저장소 뿌리 기준 경로)을 무리로 나눈다. 나머지(DOM 없는 순수 시험)는 `node` 무리다.
 * 노드 시험과 DOM 시험이 한 워커에서 번갈아 돌면 환경을 갈아 끼우느라 둘을 따로 돌린 합보다 25초쯤 더 걸려 무리를 나눴다.
 */
export function unitTestGroups(root: string): UnitTestGroups {
  const sources = readdirSync(join(root, 'src'), { recursive: true, encoding: 'utf8' })
    .filter((file) => TEST_FILE.test(file))
    .map((file) => `src/${file.split('\\').join('/')}`)
    .map((file) => ({ file, source: readFileSync(join(root, file), 'utf8') }))
  const isolated = new Set(ISOLATED_TEST_FILES)
  for (const { file, source } of sources) if (MOCKS_MODULES.test(source)) isolated.add(file)
  const dom = sources.filter(({ file, source }) => !isolated.has(file) && DOM_ENVIRONMENT.test(source)).map(({ file }) => file)
  return { dom: dom.sort(), isolated: [...isolated].sort() }
}
