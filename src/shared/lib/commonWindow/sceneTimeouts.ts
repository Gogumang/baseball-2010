import { setTickInterval } from '@/shared/lib/frameClock/frameClock'
import { freeze, sceneTimers, type SceneTimer } from '@/shared/lib/commonWindow/freezeState'
import { runSceneTimer, settlePendingFreeze } from '@/shared/lib/commonWindow/freezeClock'
import { gameSceneNow, gameSceneTickNow, gameSceneTickOf, gameSceneTickStartTime, isGameSceneFrozen } from '@/shared/lib/commonWindow/sceneClock'

/**
 * **경기 장면 시계로 재는 setTimeout** — 경기 장면의 상태 길이(상태 틱 [장면+0x2c] 를 세는 갱신 · 진입 · 그 그림의 소리)는
 * 공용 창이 서 있는 동안 52cc6 이 장면 틱 0xbc9c9 · 진입 표 0xd04bc · 갱신 표 0xd0530 을 통째로 건너뛰어 서고, 닫히면 그 자리에서
 * 이어 센다(따라잡지 않는다). 웹 시계도 그동안 남은 시간을 붙잡아 두었다가 닫히면 남은 만큼만 더 기다린다.
 * 장면이 멈춰 있지 않으면 `setTimeout` 과 같고, 멈춘 동안 건 시계는 풀린 때부터 잰다. 경기 장면 밖에서는 늘 그냥 흐른다.
 */
function addSceneTimer(callback: () => void, remaining: number, dueTick: number | null): number {
  const id = freeze.nextSceneTimerId
  freeze.nextSceneTimerId += 1
  const timer: SceneTimer = { callback, remaining: Math.max(0, remaining), dueTick, startedAt: null, handle: null }
  sceneTimers.set(id, timer)
  settlePendingFreeze()
  if (freeze.frozenSince === null) runSceneTimer(id, timer, performance.now())
  return id
}

/** 경기 장면 시계로 `delay` ms 뒤 `callback` — `clearGameSceneTimeout` 으로 거둔다 */
export function setGameSceneTimeout(callback: () => void, delay: number): number {
  return addSceneTimer(callback, delay, null)
}
/** `setGameSceneTimeout` 으로 건 시계를 거둔다(이미 울렸거나 없는 번호면 아무 일 없다) */
export function clearGameSceneTimeout(id: number | null | undefined): void {
  if (id == null) return
  const timer = sceneTimers.get(id)
  if (timer === undefined) return
  if (timer.handle !== null) clearTimeout(timer.handle)
  sceneTimers.delete(id)
}
/**
 * **장면 틱으로 재는 setTimeout** — 지금 틱에서 `ticks` 틱 뒤의 틀 머리에 `callback` 을 부른다. 상태 길이(그림 수)를 시각으로
 * 곱해 걸면 건 때가 틱 안쪽이라 끝도 틱 안쪽에 선다 — 이 시계는 끝을 장면 틱 격자에 맞춘다(`setGameSceneTimeout` 위에 선다 —
 * 창이 떠 있는 동안 선다).
 */
export function setGameSceneTickTimeout(callback: () => void, ticks: number): number {
  return addSceneTimer(callback, 0, gameSceneTickNow() + Math.max(0, ticks))
}
/**
 * **장면 틱 머리마다 부르는 setInterval** — `window.setInterval(…, millisecondsPerFrame())` 대신 경기 장면 부품(구질 목록 · 조준 ·
 * 게이지 따위)이 장면 틱 격자에 맞춰 센다. 공용 창이 서 있는 동안(장면 시계가 선다)은 실제 시각 한 틀마다 부른다 — 부르는 쪽이
 * `isGameSceneFrozen` 으로 갱신을 거르고 창이 선 첫 그림(`createGameSceneDrawGate`)을 센다. 돌려준 함수로 거둔다.
 */
export function setGameSceneTickInterval(callback: () => void): () => void {
  return setTickInterval(callback, { now: gameSceneNow, tickOf: gameSceneTickOf, startTimeOf: gameSceneTickStartTime }, isGameSceneFrozen)
}
