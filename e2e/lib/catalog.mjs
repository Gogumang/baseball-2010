// **장면 · 도메인 목록** — 장면 표 도메인 파일(`src/app/dev/scenes/<도메인>.ts`)과 시험 쪽 도메인 파일(`e2e/areas/<도메인>.mjs`)을 읽는다.
// 장면 이름 · 도메인 · 스냅샷은 장면 표에서, 연 상태(`actions`) · 기본 상태 표지(`expect`) · 허용 겹침(`allowed`) · 바뀐 파일 → 도메인
// 경로 머리(`sources`) · 대표 장면(`representative`)은 시험 쪽에서. 새 도메인은 두 파일을 더하기만 하면 된다(여기는 안 고친다).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../..', import.meta.url).pathname
const SCENE_DIR = join(ROOT, 'src/app/dev/scenes')
const AREA_DIR = join(ROOT, 'e2e/areas')
/** 장면 표 폴더에서 도메인이 아닌 파일 */
const NOT_AREAS = new Set(['index.ts', 'steps.ts', 'routes.ts', 'careerRoutes.ts'])

const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

/** 장면 표의 장면 — `[{ name, area, snapshot }]` (장면 표 차례). `derby-stage<N>` 처럼 함수로 짓는 장면은 빠진다 */
export function sceneCatalog() {
  const scenes = []
  for (const file of readdirSync(SCENE_DIR)
    .filter((name) => name.endsWith('.ts') && !NOT_AREAS.has(name))
    .sort()) {
    const area = kebab(file.replace(/\.ts$/, ''))
    const source = readFileSync(join(SCENE_DIR, file), 'utf8')
    for (const match of source.matchAll(/^ {2}'?([a-z][a-z0-9-]*)'?: \{([\s\S]*?)^ {2}\},?$/gm)) {
      const snapshot = /^\s{4}snapshot: '([^']+)'/m.exec(match[2])?.[1] ?? null
      scenes.push({ name: match[1], area, snapshot })
    }
  }
  return scenes
}

/** 시험 쪽 도메인 — `{ <도메인>: { actions, expect, allowed, sources, representative } }` */
export const AREAS = Object.fromEntries(
  await Promise.all(
    readdirSync(AREA_DIR)
      .filter((name) => name.endsWith('.mjs'))
      .sort()
      .map(async (file) => {
        const module = await import(join(AREA_DIR, file))
        return [
          file.replace(/\.mjs$/, ''),
          {
            actions: module.actions ?? {},
            expect: module.expect ?? {},
            allowed: module.allowed ?? [],
            sources: module.sources ?? [],
            representative: module.representative ?? null,
          },
        ]
      }),
  ),
)

/** 장면 → 연 상태 표 · 기본 상태 표지 · 허용 겹침 (도메인 파일을 모은 것) */
export const ACTIONS = Object.assign({}, ...Object.values(AREAS).map((area) => area.actions))
export const SCENE_EXPECT = Object.assign({}, ...Object.values(AREAS).map((area) => area.expect))
export const AREA_ALLOWED = Object.values(AREAS).flatMap((area) => area.allowed)

/** 바뀐 파일 하나 → 도메인들 (장면 표 · 시험 도메인 파일 자신 포함) */
export function areasOfFile(file) {
  const own = /^src\/app\/dev\/scenes\/(\w+)\.ts$/.exec(file) ?? /^e2e\/areas\/([\w-]+)\.mjs$/.exec(file)
  if (own !== null && !NOT_AREAS.has(`${own[1]}.ts`)) return [kebab(own[1])]
  return Object.entries(AREAS)
    .filter(([, area]) => area.sources.some((prefix) => file.startsWith(prefix)))
    .map(([name]) => name)
}
