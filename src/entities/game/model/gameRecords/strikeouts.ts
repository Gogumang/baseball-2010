import { OUTS_PER_INNING } from '@/entities/game/model/gameRecords/outs'

const STRIKEOUT = {
  threePitch: 16,
  fullCount: 17,
  combo: 18,
  pitcherTotal: 21,
  threePitchInning: 25,
} as const
/** 삼진 콤보는 3·6·9 연속에서 준다 (18·19·20) */
const COMBO_STEPS = [3, 6, 9]
/** 한 투수 삼진은 10·15·20 에서 준다 (21·22·23) */
const PITCHER_TOTAL_STEPS = [10, 15, 20]
/** 삼구 삼진 — 세 개로 끝낸 삼진 */
const THREE_PITCH_COUNT = 3
/** 풀카운트 = 볼 셋 */
const FULL_COUNT_BALLS = 3
/** 삼구 삼자범퇴 — 한 이닝을 공 셋으로 끝낸다 */
const THREE_PITCH_INNING_PITCHES = 3

export interface StrikeoutRecordInput {
  /** 이 타석에서 던진 공 수 */
  readonly pitches: number
  /** 끝났을 때의 볼 카운트 */
  readonly balls: number
  /** 이 삼진까지 이어진 연속 삼진 수 */
  readonly comboCount: number
  /** 이 삼진까지 우리 투수가 잡은 삼진 수 */
  readonly pitcherStrikeouts: number
}

/**
 * 삼진 계열 기록 — 판정 자리는 셋으로 나뉜다 (R8 7절·9절 확정):
 *   16·17 삼구/풀카운트 삼진 → 0xa7c4c · **18~23 삼진 콤보와 한 투수 10/15/20 삼진 → 0xa7998**
 *   25 삼구 삼자범퇴 → 0xa7d0c
 *   16 삼구 삼진 · 17 풀카운트 삼진 · 18~20 삼진 콤보 x3/x6/x9 · 21~23 한 투수 10/15/20삼진
 * 우리 투수가 잡은 삼진에만 준다 (0xa77f0 게이트가 수비 팀이 사람 팀인지 본다).
 */
export function strikeoutRecordIdsOf(input: StrikeoutRecordInput): number[] {
  return [...strikeoutCallRecordIdsOf(input), ...strikeoutTallyRecordIdsOf(input)]
}

/** 삼진 콜 `0xa7c4c` 의 16 삼구 · 17 풀카운트 — 공 도착 판정 0x3dfac 의 삼진 갈래가 부른다(판 종류와 무관) */
export function strikeoutCallRecordIdsOf(input: Pick<StrikeoutRecordInput, 'pitches' | 'balls'>): number[] {
  const ids: number[] = []
  if (input.pitches === THREE_PITCH_COUNT) ids.push(STRIKEOUT.threePitch)
  if (input.balls === FULL_COUNT_BALLS) ids.push(STRIKEOUT.fullCount)
  return ids
}

/**
 * 정산 `0xa8024` 의 a8d5a `0xa7998` — 18~20 삼진 콤보 · 21~23 한 투수 10/15/20 삼진. a8d38 이 판 종류 state[0x26] 4·5(견제 ·
 * 도루)면 R+0x134(코드 0x18)와 함께 건너뛴다 — 삼진 + 도루 판(종류 5)으로 끝난 삼진은 이 기록을 안 받는다.
 */
export function strikeoutTallyRecordIdsOf(input: Pick<StrikeoutRecordInput, 'comboCount' | 'pitcherStrikeouts'>): number[] {
  const ids: number[] = []
  const comboStep = COMBO_STEPS.indexOf(input.comboCount)
  if (comboStep >= 0) ids.push(STRIKEOUT.combo + comboStep)
  const totalStep = PITCHER_TOTAL_STEPS.indexOf(input.pitcherStrikeouts)
  if (totalStep >= 0) ids.push(STRIKEOUT.pitcherTotal + totalStep)
  return ids
}

/** 삼구 삼자범퇴 (25) — 한 이닝을 공 셋으로 끝냈는가 */
export function threePitchInningRecordIdsOf(pitchesInInning: number, outs: number): number[] {
  return pitchesInInning === THREE_PITCH_INNING_PITCHES && outs >= OUTS_PER_INNING ? [STRIKEOUT.threePitchInning] : []
}
