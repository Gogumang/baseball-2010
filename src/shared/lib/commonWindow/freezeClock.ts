import { appTickOf, appTickStartTime } from '@/shared/lib/frameClock/frameClock'
import { freeze, sceneTimers, type PendingFreeze, type SceneTimer } from '@/shared/lib/commonWindow/freezeState'

/**
 * **경기 장면 멈추기 · 풀기** — 공용 창이 선 동안(게이트 52cc6) 장면 시계와 장면 시계로 건 setTimeout 을 붙잡고, 닫히면 이어 흘린다.
 * 멈춤 · 늦춘 멈춤 · 시계 붙잡기/다시 걸기가 서로 부르므로 한 파일에 둔다(칸은 `freezeState`).
 */

/**
 * 지금 여는 창은 경기 장면 틀의 갱신 안(키 0x498d4 · 진입 · 갱신 — 게이트 52cc6 뒤)에서 연다 — 같은 앱 틱 안에 서는 공용 창은 그 틱이
 * 끝난 뒤(다음 앱 틱 머리)부터 장면을 멈추고, 창이 선 첫 그림([창+0x250] 의 다시 그리기)을 따로 세지 않는다(`pendingFreeze` 머리말)
 */
export function noteCommonWindowOpensInSceneUpdate(now: number = performance.now()): void {
  freeze.inSceneUpdateOpenAppTick = appTickOf(now)
}

function beginFreeze(at: number, appTick: number, bumpsFirstDraw: boolean): void {
  freeze.frozenSince = at
  freeze.frozenSinceAppTick = appTick
  if (bumpsFirstDraw) {
    freeze.freezeSerial += 1
    if (freeze.loadingScenesUp === 0) freeze.backdropFreezeSerial += 1
  }
  for (const timer of sceneTimers.values()) pauseSceneTimer(timer, at)
}

/** 늦춘 멈춤의 앱 틱 머리가 지났으면 그 머리에서 멈춘다 — 시계를 읽는 곳마다 먼저 부른다 */
export function settlePendingFreeze(now: number = performance.now()): void {
  const pending = freeze.pendingFreeze
  if (pending === null || appTickOf(now) < pending.appTick) return
  freeze.pendingFreeze = null
  if (pending.handle !== null) clearTimeout(pending.handle)
  // 장면 틱은 갱신을 다 돈 앞 틱에 선다 — 장면 시각은 멈춘 틱 머리에서 선다
  beginFreeze(appTickStartTime(pending.appTick), pending.appTick - 1, pending.bumpsFirstDraw)
}

/** 창이 섰다 — 틀 머리 앞이면 곧바로 멈추고(첫 그림을 센다), 갱신 안에서 연 창이면 다음 앱 틱 머리로 늦춘다 */
function startFreeze(now: number): void {
  const appTick = appTickOf(now)
  const opensInUpdate = freeze.inSceneUpdateOpenAppTick === appTick
  freeze.inSceneUpdateOpenAppTick = null
  if (!opensInUpdate) {
    beginFreeze(now, appTick, true)
    return
  }
  const pending: PendingFreeze = { appTick: appTick + 1, bumpsFirstDraw: false, handle: null }
  freeze.pendingFreeze = pending
  pending.handle = setTimeout(
    () => {
      pending.handle = null
      settlePendingFreeze()
    },
    Math.max(0, appTickStartTime(appTick + 1) - now),
  )
}

/** 창이 그 틱 안에 다시 내려갔다 — 늦춘 멈춤을 거둔다(멈추지 않는다) */
function cancelPendingFreeze(pending: PendingFreeze): void {
  if (pending.handle !== null) clearTimeout(pending.handle)
  freeze.pendingFreeze = null
}

/** 창이 닫혔다 — 멈춘 시간 · 앱 틱을 쌓고 붙잡은 시계를 다시 건다 */
function endFreeze(frozenSince: number, now: number): void {
  freeze.frozenTotal += Math.max(0, now - frozenSince)
  // 창이 선 틀부터 닫힌 틀까지 앱 틱 수 — 닫힌 틀이 든 앱 틱은 멈춘 장면 틱 그대로이고 다음 앱 틱 머리에서 하나 오른다
  freeze.frozenTicks += Math.max(0, appTickOf(now) - (freeze.frozenSinceAppTick ?? appTickOf(now)))
  freeze.frozenSince = null
  freeze.frozenSinceAppTick = null
  for (const [id, timer] of sceneTimers) runSceneTimer(id, timer, now)
}

export function syncGameSceneFreeze(now: number = performance.now()): void {
  settlePendingFreeze(now)
  const isFrozen = freeze.gameScenesUp > 0 && freeze.shownCommonWindows > 0
  if (isFrozen) {
    if (freeze.frozenSince === null && freeze.pendingFreeze === null) startFreeze(now)
    return
  }
  if (freeze.pendingFreeze !== null) cancelPendingFreeze(freeze.pendingFreeze)
  else if (freeze.frozenSince !== null) endFreeze(freeze.frozenSince, now)
}

export function runSceneTimer(id: number, timer: SceneTimer, now: number): void {
  if (timer.handle !== null) return
  timer.startedAt = now
  // 틱 시계는 남은 ms 가 아니라 울릴 장면 틱의 머리(= 앱 틱 머리)까지 잰다 — 창이 닫힌 뒤에도 틱 머리에 선다
  const delay = timer.dueTick === null ? timer.remaining : Math.max(0, appTickStartTime(timer.dueTick + freeze.frozenTicks) - now)
  const dueAt = now + delay
  timer.handle = setTimeout(() => {
    timer.handle = null
    // 늦춘 멈춤(갱신 뒤에 연 창)의 머리가 이 시계보다 먼저면 이 시계는 창 아래에서 선다
    settlePendingFreeze()
    if (freeze.frozenSince !== null && dueAt >= freeze.frozenSince) {
      if (timer.dueTick === null) timer.remaining = Math.max(0, dueAt - freeze.frozenSince)
      timer.startedAt = null
      return
    }
    sceneTimers.delete(id)
    timer.callback()
  }, delay)
}

function pauseSceneTimer(timer: SceneTimer, now: number): void {
  if (timer.handle === null) return
  clearTimeout(timer.handle)
  timer.handle = null
  if (timer.dueTick === null) timer.remaining = Math.max(0, timer.remaining - Math.max(0, now - (timer.startedAt ?? now)))
  timer.startedAt = null
}
