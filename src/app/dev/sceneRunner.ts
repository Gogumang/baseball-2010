/// <reference types="vite/client" />
import { sceneHandlesNow, setDevBootSeed } from '@/app/dev/sceneShortcut'
import type { SceneHandles } from '@/app/dev/sceneShortcut'
import { SCENES } from '@/app/dev/scenes'
import { scenePeeksNow, setSceneFastForward } from '@/shared/lib/scenePeek/scenePeek'
import { touchKeyOffersNow } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { SceneStep } from '@/app/dev/scenes'

/**
 * **장면 바로가기 진행기** (개발 · e2e 전용 — `sceneShortcut.ts` 머리말). `main.tsx` 가 켜졌을 때만 동적으로 읽는다.
 *
 * 1. 앱을 그리기 전 — `?fixture=<이름>` 이면 `e2e/fixtures/<이름>.json` 의 저장 칸을 localStorage 에 깐다(세션 훅들이 첫 그림에서
 *    저장을 읽으므로 그 전이어야 한다). 픽스처에 `seed` 가 있으면 부팅 씨앗으로 쓴다.
 * 2. 앱을 그린 뒤 — `?scene=<이름>` 이면 `scenes.ts` 의 단계(세션 훅의 진입 함수 · 키 · 기다림)를 차례로 밟는다.
 *
 * 진행 상태는 `<html data-scene="loading|ready|error">` 와 `window.__scene` 에 적는다 — e2e 도우미(`e2e/lib/scene.mjs`)가 기다린다.
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

interface SceneStatus {
  scene: string | null
  fixture: string | null
  status: 'loading' | 'ready' | 'error' | 'idle'
  error: string | null
  steps: string[]
}

declare global {
  interface Window {
    __scene?: SceneStatus
    /** 지금 화면 한 줄 요약 — e2e 도우미 `screenState` 가 읽는다 */
    __sceneProbe?: () => unknown
  }
}

const status: SceneStatus = { scene: null, fixture: null, status: 'idle', error: null, steps: [] }

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
    if (scene === null) report({ status: 'ready' })
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
  if (status.status === 'error' || status.scene === null) return
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
    report({ status: 'ready' })
  } catch (error) {
    report({ status: 'error', error: String(error) })
  } finally {
    setSceneFastForward(false)
  }
}
