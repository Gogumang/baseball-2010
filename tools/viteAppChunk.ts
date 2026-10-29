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
 * 시험(vitest)에는 붙지 않는다(`apply: 'build'`).
 */
const APP_MODULE = /[\\/]src[\\/]app[\\/]ui[\\/]App\.tsx$/

interface ModuleGraph {
  readonly isEntry: (id: string) => boolean
  readonly staticImportsOf: (id: string) => readonly string[]
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

function appOnlyModulesOf(moduleIds: readonly string[], graph: ModuleGraph): Set<string> {
  const appModule = moduleIds.find((id) => APP_MODULE.test(id))
  if (appModule === undefined) return new Set()
  const entryModules = staticClosureOf(moduleIds.filter(graph.isEntry), graph)
  const appModules = staticClosureOf([appModule], graph)
  return new Set([...appModules].filter((id) => !entryModules.has(id)))
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
      }
      appOnlyModules = appOnlyModulesOf([...this.getModuleIds()], graph)
    },
  }
}
