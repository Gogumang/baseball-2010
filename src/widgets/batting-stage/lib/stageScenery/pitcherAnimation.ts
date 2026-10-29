import {
  ACE_PITCH_LAST_STEPS,
  ACE_PITCH_STEP_DURATIONS,
  IDLE_DURATIONS,
  IDLE_LAST_STEP,
  PITCH_LAST_STEP,
  PITCH_STEP_DURATIONS,
} from '@/widgets/batting-stage/lib/stageScenery/pitchStepTables'
import { IDLE_STARTS, PITCHER_IDLE_TICKS, aceRowOf, pitchStepAt, stepAt } from '@/widgets/batting-stage/lib/stageScenery/pitchSteps'

/**
 * **투수 그림 객체** (vtable 0xd73d0 — 갱신 0x9e004 → 0x9df8c · 자세 0x9e0b8, 경기 +0xf98). 2026-10-15 직접 떴다.
 * ```
 * 9dff8  상태 걸기(o, s): +0x14 = s · 단계 +0x1c = 0 · 카운터 +0x20 = 0
 * 9df8c  상태 1: 마투수(+0x24 ≥ 0)면 마지막 단계 = s8 0xd744f[u] · 유지 = s8 (0xd73fa + 17u)[단계],
 *               아니면 마지막 = 0xd · 유지 = s8 0xd73e9[단계]
 *        상태 2: 마지막 = 4 · 유지 = s8 0xd73e4[단계]
 *        c = 카운터++ ; c ≥ 유지 ∧ 단계 < 마지막 이면 단계 + 1 · 카운터 = 0        (그 밖 상태는 안 센다)
 * 9e004  갱신 뒤 상태 2 이고 단계 > 3 이면 9dff8(o, 0) — 대기는 **한 바퀴**만 하고 선 자세로 돌아온다
 * 9e0b8  상태 0 · 1: 마투수면 s8 (0xd7483 + 17u)[단계], 아니면 폼 0·1 / 2·3 / 4·5 → 0xd7475 / 0xd7467 / 0xd7459 [단계]
 *        상태 2: 마투수면 0, 아니면 0xd7454[단계]
 * ```
 * u = 마투수 순번 — 경기 장면은 0x35650 이 `0xb63a0(투수)` 를 +0x24 에 적는다(35686). 다른 화면 셋업(0x5690 · 0x61c0 · 0x108d2 · 0x65346)은 −1.
 * 상태를 거는 곳(경기 +0xf98): **0xf 진입 0x3d954 · 0xd 진입 0x48d50 → 0x35650 → 0x340c0 = 상태 0**,
 * 0x11 진입 0x3de10(3de7c) = 상태 1, 빈 구질 칸 키 0x50de8 = 상태 2.
 *
 * **갱신 0x9e004 를 부르는 곳 — 0xf 갱신 0x39c1c(39c28 vt+8) · 0x11 갱신 0x4e060(4e070 vt+8) 둘뿐** (2026-10-15 전수):
 * 0x9e005 는 vtable 0xd73d8 칸에만 있고(BL 없음), 0x9df8c 를 BL 하는 곳도 0x9e008 하나다. 경기 +0xf98 을 읽는 22곳
 * (`xval 0xf98`)을 다 떠 보면 vt+8 을 부르는 것은 위 둘이고, 나머지는 상태 걸기 · +8 · +0x10 읽기 · 자세 0x9e0b8 뿐이다.
 * 갱신 표 0xd0530(0x52c50 52e44~)에서 0xd 0x39e14 · 0xe 0x39bd4 · 0x10 0x39c5c · 0x12 0x4e6d4 · 0x13 0x406e8 은 투수를 안 센다.
 * 그래서 **단계는 0x11 의 마지막 갱신에서 굳고**(0x12 · 0x13 은 그 단계 그대로 — 공이 빨리 닿으면 마지막 단계 전에 굳는다),
 * 대기 동작(상태 2)도 **0xf 를 떠나면(0x10 조준) 그 단계에 굳는다**. 다음 0xd · 0xf 진입이 상태 0 으로 되돌린다 —
 * 0xd 진입이 상태 0 을 걸고 0xd 갱신 0x39e14 가 0xe 를 예약하므로, 0xd → 0xe 로 쉬는 동안 투수는 상태 0 이다(웹 쉬는 '대기').
 * 0xe 를 예약하는 곳은 0x39e2e(0xd 갱신)와 0x4984a(0xb 교체 화면의 # · CLR) 둘뿐이다(0xbcb48 부름 269곳의 `movs r1, #0xe`).
 * 0xb 는 0xe · 0xf 의 '#'(0x499f4)로 들고 갱신 칸이 비어 있어, 0xf 에서 대기 동작 중에 '#' 를 누르면 0xb → 0xe 동안 그 단계에
 * 굳어 있다가 다음 0xf 진입에 상태 0 이 된다. 웹(`PitcherSideStage`)은 0xb 동안 구질 목록 부품이 내려가 `idleEndTick` 이 서고(굳음),
 * 0xb 에서 곧장 선 0xe 는 0xd 표지(`sceneDEntryMark`)를 안 바꿔 그대로 굳어 있다가, OK 뒤 0xf 진입(`entersStateF`)에 상태 0 이 된다
 * (`PitcherSideStage.idle.test`).
 *
 * 한 그림 차례(0x52c50): 진입 표 → 키(0x498d4 → 조작 0x536bc → 0x534d8 → 0xbfbad 바로 보냄 → 0x509a0 메시지 7 → 0x50de8)
 * → 갱신 표 → 그리기. 그래서 0x11 진입 그림과 빈 칸 키 그림은 둘 다 **상태를 건 그 그림에 한 번 센 단계로 그린다**(틱 0).
 */

export interface PitcherAnimation {
  /** +0x14 — 0 선 자세 · 1 투구 · 2 대기 동작 */
  readonly state: 0 | 1 | 2
  /** +0x1c */
  readonly step: number
}

/** 투수 그림 객체에 상태를 건 두 사건의 틱 — 웹 장면이 드는 것 */
export interface PitcherAnimationClock {
  /** 0x11 진입(0x3de10 → 상태 1) 뒤 틱. 다음 0xd · 0xf 진입(→ 상태 0)까지 산다. 없으면 null */
  readonly pitchTick: number | null
  /**
   * 0x11 의 마지막 갱신 틱(0x4e060 이 0x12 · 0x13 을 예약한 그림, `pitchTick` 셈) — 그 뒤로는 0x9e004 가 안 불려 단계가 굳는다.
   * 아직 0x11 이면 null
   */
  readonly pitchEndTick?: number | null
  /** 빈 구질 칸 키(0x50de8 → 상태 2) 뒤 틱. 없으면 null */
  readonly idleTick?: number | null
  /** 0xf 의 마지막 갱신 틱(0x39c1c, `idleTick` 셈) — 0x10 조준에 들면 대기 동작이 그 단계에 굳는다. 아직 0xf 면 null */
  readonly idleEndTick?: number | null
}

/** 갱신 0x9e004 가 불린 수만큼만 센 틱 — 끝 틱이 있으면 거기서 멈춘다 */
function countedTickOf(tick: number, endTick: number | null | undefined): number {
  return endTick === null || endTick === undefined ? tick : Math.min(tick, endTick)
}

/**
 * 투수 그림 객체의 지금 상태. 둘 다 있으면 투구가 나중 사건이다(빈 칸 키는 0xf 에서만 받고 0x11 이 그 뒤다).
 * 틱 0 은 상태를 건 그림 — 같은 그림의 갱신(0x39c1c · 0x4e060)이 이미 한 번 센 단계다(0x11 진입 · 빈 칸 키 모두, 위 차례).
 */
export function pitcherAnimationAt(clock: PitcherAnimationClock, aceOrder?: number | null): PitcherAnimation {
  if (clock.pitchTick !== null) {
    return { state: 1, step: pitchStepAt(countedTickOf(clock.pitchTick, clock.pitchEndTick), aceOrder) }
  }
  const idleTick = clock.idleTick ?? null
  const countedIdleTick = idleTick === null ? null : countedTickOf(idleTick, clock.idleEndTick)
  if (countedIdleTick !== null && countedIdleTick >= 0 && countedIdleTick < PITCHER_IDLE_TICKS) {
    return { state: 2, step: stepAt(countedIdleTick, IDLE_STARTS, IDLE_LAST_STEP) }
  }
  return { state: 0, step: 0 }
}

/**
 * 0x9df8c 의 상태별 규칙 — 단계 유지 표와 마지막 단계. 상태 0 · 그 밖은 안 센다(null).
 * 명예의 전당 목록 그림(`pages/special/lib/hallOfFameFigure`)도 같은 객체(vtable 0xd73d0)라 이 표를 쓴다.
 */
export function pitcherStepRuleOf(
  state: number,
  aceOrder?: number | null,
): { readonly durations: readonly number[]; readonly lastStep: number } | null {
  const row = aceRowOf(aceOrder)
  if (state === 1) {
    return row === null
      ? { durations: PITCH_STEP_DURATIONS, lastStep: PITCH_LAST_STEP }
      : { durations: ACE_PITCH_STEP_DURATIONS[row], lastStep: ACE_PITCH_LAST_STEPS[row] }
  }
  if (state === 2) return { durations: IDLE_DURATIONS, lastStep: IDLE_LAST_STEP }
  return null
}
