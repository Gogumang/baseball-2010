import { appTickOf, appTickStartTime } from '@/shared/lib/frameClock/frameClock'
import { freeze } from '@/shared/lib/commonWindow/freezeState'
import { settlePendingFreeze } from '@/shared/lib/commonWindow/freezeClock'

/** 경기 장면 0x52c50 이 52cc6 · 52efe · 53048 에서 이 그림을 건너뛰는가 (`gameScenesUp` 머리말) */
export function isGameSceneFrozen(): boolean {
  settlePendingFreeze()
  return freeze.frozenSince !== null
}
/**
 * **경기 장면 시계** — 실제 시각 `raw`(`performance.now()` · requestAnimationFrame 시각)를 장면이 흐른 시각으로 바꾼다.
 * 장면이 멈춘 동안은 멈춘 시각에 서 있고, 풀리면 멈춰 있던 만큼 빼고 이어 흐른다(52cc6 — 건너뛴 틱을 따라잡지 않는다).
 * 경기 장면 부품이 쓰는 시각(단계 시작 · 키를 받은 시각 · 그림 시각)은 모두 이 시계로 재야 서로 맞는다.
 */
export function gameSceneTimeOf(raw: number): number {
  settlePendingFreeze()
  return (freeze.frozenSince === null ? raw : Math.min(raw, freeze.frozenSince)) - freeze.frozenTotal
}
/** 지금 경기 장면 시각 — `gameSceneTimeOf(performance.now())` */
export function gameSceneNow(): number {
  return gameSceneTimeOf(performance.now())
}
/**
 * **경기 장면 틱** — 경기 장면 시계(`gameSceneTimeOf`)를 그림 길이(`millisecondsPerFrame()`)로 센 정수. 원본 경기 장면 0x52c50 은 한 틀에
 * 한 번 갱신하고(52cd4 의 0xbc9c9 — 상태 틱 [장면+0x2c] +1 · 진입) 한 번 그린다 — 이 틱 하나가 그 틀이다. 장면 부품은 단계 시작을
 * **그 단계가 선 장면 틱 번호**로 적고 단계 안 진행은 (지금 틱 − 시작 틱)으로 센다 — 그래서 그림은 틱마다 많아야 한 번 바뀌고,
 * 단계 경계가 모두 같은 격자 위에 선다. 창이 떠 있는 동안은 시계가 서므로 틱도 안 오른다(52cc6 — 따라잡지 않는다).
 *
 * 틱은 따로 기준점을 잡지 않고 **앱 틱(`frameClock`)에서 멈춰 있던 앱 틱 수를 뺀 값**이다(r160). 원본은 앱 루프 하나가 틀을 돌리고
 * 경기 장면은 창이 선 틀에 갱신만 건너뛴다 — 틀 머리는 늘 앱 틀이다. 예전처럼 장면 시각(ms)에 따로 격자를 깔면 멈춘 ms 만큼 격자가
 * 틀 안쪽으로 밀리고, 창이 떠 있는 동안 속도를 바꾸면 앱 틱과 장면 틱이 서로 다른 때에 기준점을 다시 잡았다.
 *
 * 상태가 바뀌는 틱(2026-10-24 직접 떴다): 0xbcb48(상태 객체, 새 상태)이 +8 에 예약만 하고, 다음 틀 머리 0xbc9c8 이
 * `+4 ≠ +8` 이면 +0x10 = 옛 상태 · **+0x14(틱) = 0** · +4 = 새 상태 · +0x19(진입) = 1 을 적는다(bc9e8~bc9f4). 같으면 +0x14 += 1 ·
 * +0x19 = 0 (bc9de~bc9e4). 경기 장면은 그 뒤 52cdc 에서 [장면+0x31](진입)이 서 있으면 진입 표 0xd04bc 를 부르고, 52d9e 의 키 0x498d4 ·
 * 52e14~ 의 갱신 표 0xd0530 이 같은 틀에 틱 0 으로 돈다. 곧 **갱신에서 예약한 상태는 다음 틀이 틱 0 이다** — 웹 루프는 앞 단계의
 * 끝 틱을 본 그 틀(= 원본의 예약 다음 틀)에 새 단계를 세우므로 그 틀의 장면 틱이 새 단계의 시작 틱이다.
 */
export function gameSceneTickOf(sceneTime: number): number {
  settlePendingFreeze()
  const appTick = appTickOf(sceneTime + freeze.frozenTotal)
  // 서 있는 동안은 창이 선 앱 틱에 머문다(그 뒤 시각을 받아도 오르지 않는다)
  return (freeze.frozenSinceAppTick === null ? appTick : Math.min(appTick, freeze.frozenSinceAppTick)) - freeze.frozenTicks
}
/** 지금 장면 틱 — `gameSceneTickOf(gameSceneNow())` */
export function gameSceneTickNow(): number {
  return gameSceneTickOf(gameSceneNow())
}

/** 장면 틱 `tick` 이 시작하는 경기 장면 시각(ms) — 그 틱의 앱 틱 머리를 장면 시계로 옮긴 값 */
export function gameSceneTickStartTime(tick: number): number {
  settlePendingFreeze()
  return appTickStartTime(tick + freeze.frozenTicks) - freeze.frozenTotal
}
/** 장면 틱 `tick` 이 든 앱 틱 — 앱 전역 셈(파티클 관리자 틱 표지 따위)을 장면 부품이 같은 틀로 맞출 때 */
export function appTickOfGameSceneTick(tick: number): number {
  settlePendingFreeze()
  return tick + freeze.frozenTicks
}
