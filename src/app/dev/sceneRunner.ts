/// <reference types="vite/client" />
import { sceneHandlesNow, setDevBootSeed } from '@/app/dev/sceneShortcut'
import type { SceneHandles } from '@/app/dev/sceneShortcut'
import { SCENES } from '@/app/dev/scenes'
import { battingLogNow, scenePeeksNow, setSceneFastForward } from '@/shared/lib/scenePeek/scenePeek'
import { touchKeyOffersNow } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { appTickNow, appTickStartTime } from '@/shared/lib/frameClock/frameClock'
import type { SceneStep } from '@/app/dev/scenes'
import { captureSnapshot, fiberValuesAt, prepareSnapshot, restoreSnapshot, snapshotDigest } from '@/app/dev/sessionSnapshot'
import type { SessionSnapshotFile, SnapshotRestoreReport } from '@/app/dev/sessionSnapshot'

/**
 * **장면 바로가기 진행기** (개발 · e2e 전용 — `sceneShortcut.ts` 머리말). `main.tsx` 가 켜졌을 때만 동적으로 읽는다.
 *
 * 1. 앱을 그리기 전 — `?fixture=<이름>` 이면 `e2e/fixtures/<이름>.json` 의 저장 칸을 localStorage 에 깐다(세션 훅들이 첫 그림에서
 *    저장을 읽으므로 그 전이어야 한다). 픽스처에 `seed` 가 있으면 부팅 씨앗으로 쓴다.
 * 2. 앱을 그린 뒤 — `?scene=<이름>` 이면 `scenes/<도메인>.ts` 의 단계(세션 훅의 진입 함수 · 키 · 기다림)를 차례로 밟는다.
 *
 * 진행 상태는 `<html data-scene="loading|ready|error">` 와 `window.__scene` 에 적는다 — e2e 도우미(`e2e/lib/scene.mjs`)가 기다린다.
 *
 * **경기 중간 스냅샷** (`sessionSnapshot.ts`): 장면 표에 `snapshot` 이 있고 `e2e/snapshots/<이름>.json.gz` 가 있으면 단계를 밟지 않고
 * 그 순간을 곧장 되살린다(`&real=1` 이면 단계를 밟는다 — `e2e:all` 의 smoke). `&capture=1` 이면 단계를 다 밟은 순간(ready 바로 앞)을
 * 떠서 `window.__capturedSnapshot` 에 둔다(`yarn e2e:snapshot` 이 파일로 쓴다).
 */

/** 픽스처 파일 꼴 — `e2e/capture.mjs` 가 실제 플레이에서 뜬다 */
export interface SceneFixture {
  /** 어떻게 뜬 상태인가 (사람이 읽는 글) */
  readonly note?: string
  /** 부팅 씨앗 `bootSeed()` 대신 — 없으면 원래대로 시계 */
  readonly seed?: number
  /** localStorage 칸 → 값. 저장 모듈이 `JSON.stringify` 로 쓰므로 풀어 둔다. JSON 이 아닌 글은 `{ "$raw": 글 }` */
  readonly localStorage: Readonly<Record<string, unknown>>
}

const STORAGE_PREFIX = 'compus-baseball/'

const fixtureLoaders = import.meta.glob<SceneFixture>('../../../e2e/fixtures/*.json', { import: 'default' })
/** 스냅샷 파일은 gzip 으로 둔다(`e2e/snapshots/<이름>.json.gz` — 이야기 표 · 경기 진행 칸을 다 들어 풀면 수 MB) */
const snapshotLoaders = import.meta.glob<string>('../../../e2e/snapshots/*.json.gz', { query: '?url', import: 'default' })

async function loadSnapshotFile(url: string): Promise<SessionSnapshotFile> {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer())
  // 서버가 이미 풀어 보냈으면(Content-Encoding) 그대로 JSON 이다
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(bytes)) as SessionSnapshotFile
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return JSON.parse(await new Response(stream).text()) as SessionSnapshotFile
}

interface SceneStatus {
  scene: string | null
  fixture: string | null
  status: 'loading' | 'ready' | 'error' | 'idle'
  error: string | null
  steps: string[]
  /** 스냅샷으로 연 장면 — 그 이름과 되살린 결과 */
  snapshot: string | null
  restore: SnapshotRestoreReport | null
}

declare global {
  interface Window {
    __scene?: SceneStatus
    /** 지금 화면 한 줄 요약 — e2e 도우미 `screenState` 가 읽는다 */
    __sceneProbe?: () => unknown
    /** 타석 장면 시각 재기 — 공 그림 · 틱 격자(`BattingStagePeek`)와 스윙 · 판정 기록 (r242) */
    __batting?: () => unknown
    /** 경기 중간 스냅샷 손잡이 — 뜨기 · 요약 · 부품 자리 값 */
    __snapshot?: {
      readonly capture: (note?: string) => SessionSnapshotFile
      readonly digest: () => unknown
      readonly fiberValuesAt: (path: string) => unknown
      /** 지금 앱 틱 · 틱 `tick` 이 시작하는 `performance.now()` 시각 — 도구가 두 쪽을 같은 틱에 맞춘다 */
      readonly tick: () => number
      readonly tickStart: (tick: number) => number
      readonly now: () => number
    }
    /** `&capture=1` — 단계를 다 밟은 순간 뜬 스냅샷 */
    __capturedSnapshot?: SessionSnapshotFile
    /** 같음 확인 도구가 쪽보다 먼저 넣는 스냅샷 — 파일 대신 이것을 되살린다(`&snapshot=inject`) */
    __snapshotOverride?: SessionSnapshotFile
  }
}

const status: SceneStatus = { scene: null, fixture: null, status: 'idle', error: null, steps: [], snapshot: null, restore: null }
let loadedSnapshot: SessionSnapshotFile | null = null

function report(next: Partial<SceneStatus>): void {
  Object.assign(status, next)
  window.__scene = status
  document.documentElement.dataset.scene = status.status
}

function storedValueOf(value: unknown): string {
  if (value !== null && typeof value === 'object' && '$raw' in value) return String((value as { $raw: unknown }).$raw)
  return JSON.stringify(value)
}

async function applyFixture(name: string): Promise<void> {
  const loader = fixtureLoaders[`../../../e2e/fixtures/${name}.json`]
  if (loader === undefined) {
    throw new Error(`픽스처가 없다: ${name} (있는 것: ${Object.keys(fixtureLoaders).map((path) => path.replace(/^.*\/|\.json$/g, '')).join(', ')})`)
  }
  const fixture = await loader()
  const storage = window.localStorage
  for (const key of Object.keys(storage)) {
    if (key.startsWith(STORAGE_PREFIX)) storage.removeItem(key)
  }
  for (const [key, value] of Object.entries(fixture.localStorage)) storage.setItem(key, storedValueOf(value))
  setDevBootSeed(typeof fixture.seed === 'number' ? fixture.seed : null)
}

/** 앱을 그리기 전에 부른다 — 픽스처를 깔고, 장면을 고른다. 실패해도 앱은 그린다(상태만 error) */
export async function bootSceneShortcut(): Promise<void> {
  window.__snapshot = {
    capture: (note) => captureSnapshot({ note: note ?? '', scene: status.scene, fixture: status.fixture }),
    digest: snapshotDigest,
    fiberValuesAt,
    tick: appTickNow,
    tickStart: appTickStartTime,
    now: () => performance.now(),
  }
  window.__batting = () => ({ probe: scenePeeksNow().battingStage?.probe() ?? null, log: battingLogNow() })
  window.__sceneProbe = () => {
    const handles = sceneHandlesNow()
    if (handles === null) return null
    return {
      screen: handles.screen.kind,
      pitcherScene: handles.pitcher.scene,
      seasonScene: handles.season.scene,
      hasCareer: handles.career.career !== null,
      hasSavedCareer: handles.career.savedCareer !== null,
      // 그 순간 화면이 받는 키(터치 상황 버튼) — 경기 장면의 타석 · 투구 · 수비를 가르는 데 쓴다
      offers: touchKeyOffersNow().map((offer) => `${offer.key}:${offer.label}`),
      // 팀 경기 화면이 알리는 자리(`shared/lib/scenePeek`)
      peeks: scenePeeksNow(),
    }
  }
  const params = new URLSearchParams(window.location.search)
  const scene = params.get('scene')
  const fixture = params.get('fixture') ?? (scene === null ? null : SCENES[scene]?.fixture ?? null)
  if (scene === null && fixture === null) return
  report({ scene, fixture, status: 'loading' })
  try {
    if (scene !== null && SCENES[scene] === undefined) {
      throw new Error(`장면이 없다: ${scene} (있는 것: ${Object.keys(SCENES).join(', ')})`)
    }
    if (fixture !== null && fixture !== 'none') await applyFixture(fixture)
    // `&seed=<수>` · 장면 표의 `seed` — 픽스처의 부팅 씨앗 대신(난수로만 닿는 장면 · 씨앗 찾기). 난수 차례는 그대로다
    const seed = params.get('seed') ?? (scene === null ? undefined : SCENES[scene]?.seed?.toString())
    if (seed !== null && seed !== undefined && Number.isFinite(Number(seed))) setDevBootSeed(Number(seed))
    // 스냅샷 — 장면 표의 `snapshot` (또는 `&snapshot=<이름>`), `&real=1` 이면 안 쓴다. 파일이 없으면 단계를 밟는다
    const snapshotName = params.has('real') ? null : (params.get('snapshot') ?? (scene === null ? null : SCENES[scene]?.snapshot ?? null))
    const injected = snapshotName === 'inject' ? window.__snapshotOverride : undefined
    if (snapshotName === 'inject' && injected === undefined) throw new Error('넣은 스냅샷이 없다 (window.__snapshotOverride)')
    const urlLoader = snapshotName === null ? undefined : snapshotLoaders[`../../../e2e/snapshots/${snapshotName}.json.gz`]
    const snapshotLoader = injected !== undefined ? () => Promise.resolve(injected)
      : urlLoader === undefined ? undefined : async () => loadSnapshotFile(await urlLoader())
    if (snapshotName !== null && snapshotLoader === undefined && params.has('snapshot')) throw new Error(`스냅샷이 없다: ${snapshotName}`)
    if (snapshotLoader !== undefined) {
      loadedSnapshot = await snapshotLoader()
      prepareSnapshot(loadedSnapshot)
      report({ snapshot: snapshotName })
    }
    if (scene === null && loadedSnapshot === null) report({ status: 'ready' })
  } catch (error) {
    report({ status: 'error', error: String(error) })
  }
}

const POLL_MS = 16
const DEFAULT_UNTIL_MS = 8000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function handlesReady(): Promise<SceneHandles> {
  for (let waited = 0; waited < DEFAULT_UNTIL_MS; waited += POLL_MS) {
    const handles = sceneHandlesNow()
    if (handles !== null) return handles
    await sleep(POLL_MS)
  }
  throw new Error('App 이 손잡이를 내놓지 않았다')
}

/** 키 하나 — 터치 버튼 · 키보드와 같은 길(초점 요소 → window, 앱 키 문이 다음 틱에 다시 쏜다) */
async function pressKey(key: string): Promise<void> {
  const target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body
  const init = { key, code: key, bubbles: true, cancelable: true, composed: true }
  target.dispatchEvent(new KeyboardEvent('keydown', init))
  await sleep(60)
  target.dispatchEvent(new KeyboardEvent('keyup', init))
  await sleep(60)
}

async function runStep(step: SceneStep): Promise<void> {
  if (step.kind === 'call') return step.run(await handlesReady())
  if (step.kind === 'key') {
    for (let count = 0; count < (step.times ?? 1); count++) await pressKey(step.key)
    return
  }
  if (step.kind === 'wait') return sleep(step.ms)
  if (step.kind === 'keyUntil') {
    for (let waited = 0; waited < step.timeoutMs; waited += step.everyMs) {
      const handles = sceneHandlesNow()
      if (handles !== null && step.test(handles)) return
      if (handles !== null && step.holdWhen?.(handles) === true) {
        await sleep(step.everyMs)
        continue
      }
      await pressKey(step.key)
      await sleep(Math.max(0, step.everyMs - 120))
    }
    throw new Error(`키를 눌러도 안 닿았다: ${step.label}`)
  }
  const timeout = step.timeoutMs ?? DEFAULT_UNTIL_MS
  for (let waited = 0; waited < timeout; waited += POLL_MS) {
    const handles = sceneHandlesNow()
    if (handles !== null && step.test(handles)) return
    await sleep(POLL_MS)
  }
  const handles = sceneHandlesNow()
  throw new Error(`기다림이 안 끝났다: ${step.label} (지금 화면 ${handles?.screen.kind ?? '?'})`)
}

/** 앱을 그린 뒤에 부른다 — 장면 단계를 밟는다 */
export async function runSceneShortcut(): Promise<void> {
  if (status.status === 'error') return
  if (loadedSnapshot !== null) {
    setSceneFastForward(true)
    try {
      await handlesReady()
      status.steps.push(`스냅샷 ${status.snapshot ?? ''}`)
      const restored = await restoreSnapshot(loadedSnapshot)
      report({ status: 'ready', restore: restored })
    } catch (error) {
      report({ status: 'error', error: String(error) })
    } finally {
      setSceneFastForward(false)
    }
    return
  }
  if (status.scene === null) return
  const scene = SCENES[status.scene]
  if (scene === undefined) return
  // 단계를 밟는 동안만 연출 판(로딩)을 건너뛴다 — 장면에 닿으면 끈다(그 뒤 손으로 하는 플레이는 원래대로)
  setSceneFastForward(true)
  try {
    for (const step of scene.steps) {
      status.steps.push(step.kind === 'key' ? `key ${step.key}` : step.kind === 'wait' ? `wait ${step.ms}` : step.label)
      report({ steps: status.steps })
      await runStep(step)
    }
    // 마지막 그림이 화면에 닿게 두 틀 기다린다
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    // `&capture=1` — 이 순간(ready 와 같은 틱)을 뜬다
    if (new URLSearchParams(window.location.search).has('capture')) {
      window.__capturedSnapshot = captureSnapshot({ note: scene.description, scene: status.scene, fixture: status.fixture })
    }
    report({ status: 'ready' })
  } catch (error) {
    report({ status: 'error', error: String(error) })
  } finally {
    setSceneFastForward(false)
  }
}
