import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import { AI_STATE, type FielderState } from '@/entities/fielding/model/fieldingState'
import { CATCH_KIND } from '@/entities/fielding/model/catchPrediction'
import { isFreeToStep, withCatchMotion } from '@/entities/fielding/model/fielderPose'
import { DIVE_TICK_NONE } from '@/features/defense-play/model/catchForecast'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/**
 * **비필살 다이빙 검사** — 플레이 vt4c `0xb45dc` 야수 고리의 분기 앞 b46c2~b475a (직접 뜬 것, r180).
 * ```
 * b46c2  s = 야수 AI(+0x84) ; r4 = (s == 0xd)
 * b46ca  2 ≤ s ≤ 5 면 r4 = !0xb1b88(P, s − 2)                 ; 커버할 루가 이제 필요 없는 커버
 * b46e2  s == 0 || s == 0xa || r4 가 아니면 → b475c 분기
 * b46ee  n = P+0x178[칸] ; n == 1000 → b475c
 * b4704  ldrsh P+0x174(포구 틱) ≤ n + 5 → b475c
 * b4714  n == 공+0x68 → 야수.vt60()(0xa1ed8 — +0xb3 = 1 · vt44(방향 2/3/4 면 9/0xa/0xb, 아니면 8))
 * b4728  n > 공+0x68 − 5 → 0xa100c(야수, P(n).x, 0, P(n).z)(= vt14 0xa14c8 — 잠금 +0xb4 ≤ 0 · vtc8 일 때만 받는다) ;
 *        AI = 0xd(b474c → b48b2 0xb8dbc → b4c5c) — **분기 없이 다음 야수**
 * b4752  아니면 AI = 0(0xb8dbc) → b475c 분기는 **옛 s 로**(r5) 한다
 * ```
 * 후보 틱 n 은 예보 0xb12d0 이 적는다(`catchForecast.diveTicks`) — 공 첫 점이 표준 배팅 지점인 공(타구 · 폭투 공)만 후보가 있다.
 * P+0x174 는 `ldrsh` 라 고르기 0xb3b38 의 빈 표 틱 100000(0x186a0)은 −31072 로 읽혀 검사가 닫힌다(원본 그대로).
 * vt60 의 동작 번호(8~0xb)는 웹이 8 로 둔다 — 갈리는 것은 그림뿐이고 지우기(+0xb3 && 프레임 5)는 번호를 안 본다(`fielderPose`).
 */
export interface DiveCheckInput {
  readonly fielder: FielderState | undefined
  /** P+0x178[칸] — 공 틱 */
  readonly diveTick: number
  /** P+0x174 — 공 틱(자르기 전) */
  readonly catchTick: number
  /** 공+0x68 */
  readonly ballTick: number
  /** 0xb1b88(P, 루) — 그 루에 커버가 필요한가 */
  coverNeeded(base: number): boolean
  /** 0xa25b0(공, t) */
  ballPointAt(tick: number): WorldPoint
}

export interface DiveCheck {
  readonly fielder: FielderState
  /** AI 0xd 가 된 칸은 분기를 건너뛴다(b4c5c) */
  readonly skipDispatch: boolean
  /** 분기가 보는 AI — AI 0 으로 내린 칸도 옛 상태로 분기한다(b475c 의 r5) */
  readonly dispatchState: number
  /** vt60 을 불렀나 */
  readonly dove: boolean
}

/** ldrsh — 16비트 부호 있는 읽기 */
const int16 = (value: number): number => (value << 16) >> 16

export function diveCheckOf(input: DiveCheckInput): DiveCheck | null {
  const { fielder } = input
  if (fielder === undefined) return null
  const state = fielder.aiState
  const unneededCover = state >= AI_STATE.COVER_HOME && state <= AI_STATE.COVER_THIRD && !input.coverNeeded(state - AI_STATE.COVER_HOME)
  if (state !== AI_STATE.IDLE && state !== AI_STATE.BUSY && state !== AI_STATE.DIVE && !unneededCover) return null
  const n = input.diveTick
  if (n === DIVE_TICK_NONE) return null
  if (int16(input.catchTick) <= n + 5) return null
  let next = fielder
  const dove = n === input.ballTick
  // b4714 vt60 0xa1ed8 — 바운드 전 낮은 공 동작과 같은 칸(+0xb3 · 동작 8)
  if (dove) next = withCatchMotion(next, CATCH_KIND.GROUNDER)
  if (n > input.ballTick - 5) {
    const point = input.ballPointAt(n)
    // 0xa100c → vt14 0xa14c8: +0xb4 ≤ 0 · vtc8 일 때만 목표를 받는다
    if (next.actionLockTicks <= 0 && isFreeToStep(next)) next = { ...next, target: { x: point.x, y: 0, z: point.z } }
    return { fielder: { ...next, aiState: AI_STATE.DIVE }, skipDispatch: true, dispatchState: AI_STATE.DIVE, dove }
  }
  return { fielder: { ...next, aiState: AI_STATE.IDLE }, skipDispatch: false, dispatchState: state, dove }
}

/** 기록 줄 — 몸을 날린 틱 · AI 0xd 에 들고 나는 틱만 (키스톤 자리 잡기가 매 틱 AI 0xa 로 되돌리는 칸은 안 적는다) */
export function logDiveCheck(log: string[], tick: number, slot: number, before: FielderState | undefined, dive: DiveCheck): void {
  if (dive.dove) pushPlayLog(log, () => `${tick}틱 ${slot}번 야수가 몸을 날린다 (b4714 vt60 — 다이빙)`)
  const was = before?.aiState
  if (was === dive.fielder.aiState) return
  if (dive.fielder.aiState === AI_STATE.DIVE) pushPlayLog(log, () => `${tick}틱 ${slot}번 야수가 공 길목으로 (b4728 다이빙 검사 — AI ${was} → 0xd)`)
  else if (was === AI_STATE.DIVE) pushPlayLog(log, () => `${tick}틱 ${slot}번 야수 다이빙 끝 (b4752 — AI 0)`)
}
