import type { Plugin } from 'vite'

/**
 * **앱 덩이 하나로** (r376 — 웹 전용, 원본에 없다).
 *
 * 첫 진입(`main.tsx`)은 앱(`app/ui/App.tsx`)을 나눠 받고, 앱이 정적으로 끌고 오는 모듈은 앱을 받을 때 다 같이 받는다.
 * 그런데 그 가운데 나눠 받는 화면과 같이 쓰는 모듈을 rolldown 이 "쓰는 덩이 묶음"마다 작은 공용 덩이로 떼어 내
 * 앱 하나를 덩이 29개로 받았다. 덩이마다 따로 gzip 되니(같은 글자를 덩이마다 새로 적는다) 덩이 사이 import · export 줄까지
 * 붙어 전체 JS 가 약 20kB(gzip) 컸다. 그래서 "앱이 정적으로 끌고 오는 모듈 − 첫 진입이 정적으로 끌고 오는 모듈"을 앱 덩이 하나에 모은다.
 *
 * - 받는 것은 그대로: 원래 앱과 함께 받던 모듈만 모은다. 화면 덩이는 이미 받은 앱 덩이에서 꺼낸다.
 * - 첫 진입 덩이는 그대로: 첫 진입 몫(React 등)은 빼고, 모은 모듈의 의존도 따라 끌어오지 않는다(`includeDependenciesRecursively`
 *   를 켜 두면 React · 글꼴 같은 첫 진입 모듈까지 앱 덩이로 끌려가 첫 진입이 앱 덩이를 정적으로 받게 된다).
 * - 모듈 내용은 그대로: 덩이 나눔만 바뀐다(압축 끈 산출물로 모듈 1,777개의 코드를 견줘 이름 겹침 꼬리표 `$1` 따위만 다름 — r376).
 *
 * **작은 공용 묶음도 앱 덩이로** (r392). 나눠 받는 화면(동적 import) 둘 이상이 같이 쓰는 모듈 묶음 — 쓰는 화면 묶음이 같은 모듈끼리 —
 * 이 작으면(`SMALL_SHARED_GROUP_CHARS`) rolldown 이 1kB 안팎 덩이로 떼어 냈다(배치 · 커서 흔들기 · 그림 칸 따위 20여 개).
 * 이 묶음도 앱 덩이에 넣는다.
 * - 받는 바이트는 그대로: 배포판은 JS 덩이를 모두 첫 진입의 자산 묶음(`viteAssetPacks`)으로 미리 받는다. 바뀌는 것은 그 모듈의
 *   맨 위 코드가 화면에 들어갈 때 대신 앱 덩이를 읽을 때 돈다는 것뿐이다 — 고른 묶음의 맨 위는 함수 · 표 · 그림 주소 · 빈 Map 같은
 *   선언뿐(r392 조사: 난수 · 저장 · 소리 · 망 요청 없음)이라 결과가 같다.
 * - 스타일(`.css.ts`)이 든 묶음은 넣지 않는다 — CSS 가 앱과 함께 붙으면 스타일시트 차례가 바뀔 수 있다.
 * - 고른 묶음이 앱 밖 모듈을 정적으로 끌면(그 덩이까지 앱과 같이 읽혀) 그 묶음은 뺀다 — 앱이 정적으로 받는 덩이는 그대로다.
 * 시험(vitest)에는 붙지 않는다(`apply: 'build'`).
 */
const APP_MODULE = /[\\/]src[\\/]app[\\/]ui[\\/]App\.tsx$/
const STYLE_MODULE = /\.css(\.ts(\.vanilla\.css)?)?$/
/** 작은 공용 묶음의 상한 — 변환된(압축 전) 코드 글자 수의 합 */
const SMALL_SHARED_GROUP_CHARS = 80_000

interface ModuleGraph {
  readonly isEntry: (id: string) => boolean
  readonly staticImportsOf: (id: string) => readonly string[]
  readonly dynamicImportsOf: (id: string) => readonly string[]
  readonly codeLengthOf: (id: string) => number
}

function staticClosureOf(roots: readonly string[], graph: ModuleGraph): Set<string> {
  const seen = new Set<string>()
  const pending = [...roots]
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    if (seen.has(id)) continue
    seen.add(id)
    pending.push(...graph.staticImportsOf(id))
  }
  return seen
}

/** 나눠 받는 화면 밖 모듈마다 "그 모듈을 정적으로 끄는 동적 import 대상들" 열쇠로 묶는다 — rolldown 이 덩이를 가르는 기준과 같다 */
function sharedGroupsOf(moduleIds: readonly string[], loaded: ReadonlySet<string>, graph: ModuleGraph): Map<string, string[]> {
  const dynamicEntries = [...new Set(moduleIds.flatMap(graph.dynamicImportsOf))].filter((id) => !loaded.has(id)).sort()
  const keyByModule = new Map<string, string[]>()
  for (const dynamicEntry of dynamicEntries) {
    for (const id of staticClosureOf([dynamicEntry], graph)) {
      if (!loaded.has(id)) keyByModule.set(id, [...(keyByModule.get(id) ?? []), dynamicEntry])
    }
  }
  const groups = new Map<string, string[]>()
  for (const [id, users] of keyByModule) {
    if (users.length < 2) continue
    const key = users.join('\n')
    groups.set(key, [...(groups.get(key) ?? []), id])
  }
  return groups
}

function isSmallPlainGroup(group: readonly string[], graph: ModuleGraph): boolean {
  if (group.some((id) => STYLE_MODULE.test(id))) return false
  return group.reduce((sum, id) => sum + graph.codeLengthOf(id), 0) < SMALL_SHARED_GROUP_CHARS
}

/** 고른 묶음 가운데 앱 덩이 밖(첫 진입 · 앱 · 고른 묶음 밖) 모듈을 정적으로 끄는 것을 뺀다 — 남는 것이 없을 때까지 */
function closedGroupsOf(groups: readonly (readonly string[])[], loaded: ReadonlySet<string>, graph: ModuleGraph): Set<string> {
  let kept = [...groups]
  for (;;) {
    const allowed = new Set([...loaded, ...kept.flat()])
    const closed = kept.filter((group) => group.every((id) => graph.staticImportsOf(id).every((dep) => allowed.has(dep))))
    if (closed.length === kept.length) return new Set(kept.flat())
    kept = closed
  }
}

function appOnlyModulesOf(moduleIds: readonly string[], graph: ModuleGraph): Set<string> {
  const appModule = moduleIds.find((id) => APP_MODULE.test(id))
  if (appModule === undefined) return new Set()
  const entryModules = staticClosureOf(moduleIds.filter(graph.isEntry), graph)
  const appModules = staticClosureOf([appModule], graph)
  const loaded = new Set([...entryModules, ...appModules])
  const smallGroups = [...sharedGroupsOf(moduleIds, loaded, graph).values()].filter((group) => isSmallPlainGroup(group, graph))
  const smallShared = closedGroupsOf(smallGroups, loaded, graph)
  return new Set([...appModules, ...smallShared].filter((id) => !entryModules.has(id)))
}

export function appChunk(): Plugin {
  let appOnlyModules = new Set<string>()
  return {
    name: 'app-chunk',
    apply: 'build',
    config: () => ({
      build: {
        rolldownOptions: {
          output: {
            codeSplitting: {
              groups: [{ name: 'App', test: (id: string) => appOnlyModules.has(id), includeDependenciesRecursively: false }],
            },
          },
        },
      },
    }),
    buildEnd() {
      const graph: ModuleGraph = {
        isEntry: (id) => this.getModuleInfo(id)?.isEntry === true,
        staticImportsOf: (id) => this.getModuleInfo(id)?.importedIds ?? [],
        dynamicImportsOf: (id) => this.getModuleInfo(id)?.dynamicallyImportedIds ?? [],
        codeLengthOf: (id) => this.getModuleInfo(id)?.code?.length ?? 0,
      }
      appOnlyModules = appOnlyModulesOf([...this.getModuleIds()], graph)
    },
  }
}
