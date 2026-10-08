import { BALANCE } from '@/shared/config/original/balance'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { HIDDEN_PITCH_EVENTS } from '@/entities/pitcher-career/model/pitcherAbility'

/**
 * **구질 훈련** — 투수편 관리 화면에만 있는 칸이다 (J 3-2 확정).
 *
 * 타자편의 훈련 칸 4 는 필살타법 창(상태 0x6c)을 열지만, **모드 3 은 0x12dc0 에서 상태 0x78** 을 연다
 * (R7 4절 149행). 그 창이 이 표를 그린다.
 *
 * 표 `0xcc390` u32 **4행 × 5열** (행 = 계열, 열 0·1 기본 · 2·3 상위 · 4 히든). 이름은 원본 구질 이름표 [0x140026c](아래
 * `ORIGINAL_PITCH_TYPE_NAMES`)로 읽었다:
 * ```
 * 행0 |  2 TWO-SEAM |  3 H.FAST   | 10 CUT FAST   | 11 R.FAST     | 18 GYRO
 * 행1 |  5 SHOOT    |  4 SINKER   | 13 H.SHOOT    | 12 H.SINKER   | 19 P.SINKER
 * 행2 |  7 CURVE    |  6 SLIDER   | 15 S.CURVE    | 14 H.SLIDER   | 20 P.SLIDER
 * 행3 |  8 FORK     |  9 CHANGEUP | 16 SF         | 17 S.CHANGEUP | 21 KNUCKLE
 * ```
 * 히든 열이 보상 종류 6 의 값 v(행)와 맞는다 — 0x8beb8 이 표 0xd4e40 = [18, 19, 20, 21] 로 v → 이름을 고르고(J 3-3 의
 * 대사 이름: 33 v 0 자이로볼 · 30 v 1 파워싱커 · 31 v 2 파워슬라이더 · 32 v 3 너클볼), 0x8c5da 가 선수[0x204 + v] 로 행을 연다.
 * 칸 상태는 `커리어+0x208 + (행·2 + 열%2)·4 + 1` = **단계**(0 없음 · 1 기본 습득 · 2 상위 습득 · 히든을 마치면 3),
 * `+0x208 + 칸·4 + 0` = 그 칸의 **훈련 횟수**(`applyPitchTypeTraining`),
 * 히든 오픈은 `커리어+0x204+행` 이다. 등록에서 고른 기본 변화구 두 개가 그 칸의 단계 1 이다 (J 3-1).
 */

/**
 * 한 시즌 경기 수 45 — 이벤트 날짜 창이 쓰는 값이다 (`0xad110` 의 상수 0x2d).
 * `pitcherCareer` 에서 가져오면 값 수준 순환 가져오기가 생기므로 바탕값에서 곧장 읽는다.
 */
const GAMES_PER_SEASON = BALANCE.season.gamesPerSeason

/** 표 0xcc390 — 행 4 × 열 5, 값은 구질 번호 (1 FASTBALL … 21 SPECIAL) */
export const PITCH_TRAINING_TABLE: readonly (readonly number[])[] = [
  [2, 3, 10, 11, 18],
  [5, 4, 13, 12, 19],
  [7, 6, 15, 14, 20],
  [8, 9, 16, 17, 21],
]

export const PITCH_TRAINING_ROW_COUNT = PITCH_TRAINING_TABLE.length
export const PITCH_TRAINING_COLUMN_COUNT = 5
/** 열 4 = 히든 변화구 (이벤트 30~33 으로 계열이 열려야 배운다) */
export const HIDDEN_PITCH_COLUMN = 4

/** 비용 표 `0xcc3e0` s16 [−300, −600, −1000] 를 **열/2** 로 고른다 */
const COST_TABLE: readonly number[] = [300, 600, 1000]

export function pitchTrainingCostOf(column: number): number {
  return COST_TABLE[Math.trunc(column / 2)] ?? 0
}

/** 단계 칸 번호 = 행·2 + 열%2 (열0↔열2 · 열1↔열3 이 한 칸을 함께 쓴다) */
export function pitchTrainingCellOf(row: number, column: number): number {
  return row * 2 + (column % 2)
}

export function pitchTrainingStageOf(career: PitcherCareer, row: number, column: number): number {
  return career.pitchTrainingStages[pitchTrainingCellOf(row, column)] ?? 0
}

export function pitchTypeNumberOf(row: number, column: number): number {
  return PITCH_TRAINING_TABLE[row]?.[column] ?? 0
}

/**
 * **원본 구질 이름표** [0x140026c + 4t] (.data 23칸, 직접 읽었다 — 칸 0 은 빈 글 0xda908). 구질 번호 t 가 그대로 칸이다:
 * 1 FASTBALL … 15 S.CURVE · **16 SF** · 17 S.CHANGEUP · 18 GYRO · 19 P.SINKER · 20 P.SLIDER · 21 KNUCKLE · 22 SPECIAL(마구 칸).
 * 경기 구질 이름 그림(S5 3절 — 프레임 0x00~0x14 = 21종, SF 가 16번째 · 0x15 "????")도 같은 차례다.
 *
 * 칸 1~21 은 생성 표 `PITCH_TYPES`(생성기 `PITCH_TYPE_NAMES` — 이 이름표 칸 1~21, pitch.zt1 항목 t − 1)의 이름 그대로다.
 * 칸 0 빈 글과 칸 22 SPECIAL(마구 칸 — pitch.zt1 항목 21 은 마구 경로로 따로 그려 생성 표에 없다)만 여기서 붙인다.
 */
const MAGIC_PITCH_TYPE_LABEL = 'SPECIAL'
export const ORIGINAL_PITCH_TYPE_NAMES: readonly string[] = ['', ...PITCH_TYPES.map((type) => type.name), MAGIC_PITCH_TYPE_LABEL]

/** 구질 번호 t(1 FASTBALL … 21 KNUCKLE · 22 SPECIAL)의 이름 — 원본 이름표 [0x140026c] */
export function pitchTypeNameOf(typeNumber: number): string {
  return ORIGINAL_PITCH_TYPE_NAMES[typeNumber] ?? ''
}

export function hasPitchType(career: PitcherCareer, typeNumber: number): boolean {
  return typeNumber > 0 && ((career.pitchMask >>> (typeNumber - 1)) & 1) === 1
}

/**
 * 선행 판정 `0xa42d8`:
 *   - 열0·1 : 같은 칸 단계 ≤ 0
 *   - 열2·3 : 같은 칸(열%2) 단계 ≠ 0  (= 열0 → 열2 · 열1 → 열3)
 *   - 열4   : 계열이 열려 있고 **그 행 두 칸 중 하나라도 단계 == 2**
 */
export function meetsPitchTrainingPrerequisite(career: PitcherCareer, row: number, column: number): boolean {
  if (column === HIDDEN_PITCH_COLUMN) {
    if (!isHiddenPitchRowOpen(career, row)) return false
    return [0, 1].some((offset) => (career.pitchTrainingStages[row * 2 + offset] ?? 0) === 2)
  }
  const stage = pitchTrainingStageOf(career, row, column)
  return column < 2 ? stage <= 0 : stage !== 0
}

export function isHiddenPitchRowOpen(career: PitcherCareer, row: number): boolean {
  return career.hiddenPitchRows[row] === true
}

/**
 * 창이 칸 하나를 골랐을 때의 결과 — 원본 가드 순서 그대로다 (0x17912~0x17a4c).
 *   ① 이미 가진 구질(`0xa436c`) → **아무 말 없이 무시**
 *   ② 단계 > 열/2 → 무시
 *   ③ 열4 인데 계열 미오픈 → StrMODE[67]
 *   ④ 선행 거짓 → StrMODE[68]
 *   ⑤ G포인트 < 비용 → StrMODE[65]
 *   ⑥ 그 밖 → StrMODE[66] "%d G포인트가 소모됩니다" 확인
 */
export type PitchTrainingGate =
  | { readonly kind: '무시' }
  | { readonly kind: '막힘'; readonly textIndex: number }
  | { readonly kind: '확인'; readonly cost: number; readonly textIndex: number }

/** StrMODE 번호 (J 3-2) */
export const PITCH_TRAINING_TEXT = {
  /** [67] 아직 배울 수 없는 구질입니다 / 이벤트를 통해 오픈 */
  hiddenLocked: 67,
  /** [68] 선행 구질 훈련 완료 후 */
  prerequisite: 68,
  /** [65] G포인트가 모자랍니다 */
  notEnoughPoints: 65,
  /** [66] %d G포인트가 소모됩니다 */
  confirm: 66,
} as const

export function pitchTrainingGateOf(career: PitcherCareer, row: number, column: number): PitchTrainingGate {
  const typeNumber = pitchTypeNumberOf(row, column)
  if (typeNumber === 0) return { kind: '무시' }
  if (hasPitchType(career, typeNumber)) return { kind: '무시' }
  if (pitchTrainingStageOf(career, row, column) > Math.trunc(column / 2)) return { kind: '무시' }
  if (column === HIDDEN_PITCH_COLUMN && !isHiddenPitchRowOpen(career, row)) {
    return { kind: '막힘', textIndex: PITCH_TRAINING_TEXT.hiddenLocked }
  }
  if (!meetsPitchTrainingPrerequisite(career, row, column)) {
    return { kind: '막힘', textIndex: PITCH_TRAINING_TEXT.prerequisite }
  }
  const cost = pitchTrainingCostOf(column)
  if (career.gamePoint < cost) return { kind: '막힘', textIndex: PITCH_TRAINING_TEXT.notEnoughPoints }
  return { kind: '확인', cost, textIndex: PITCH_TRAINING_TEXT.confirm }
}

/** 필요 훈련 횟수 `0xd80de` s8 [2, 4, 5] 를 **열/2** 로 고른다 (창 글 0x18484 는 같은 값의 `0xcc362` 를 본다) */
const REQUIRED_SESSIONS: readonly number[] = [2, 4, 5]
/** G 상한 — 0xa3d42 리터럴 0x1869f */
const MAXIMUM_GAME_POINT = 99_999

export function pitchTrainingRequiredSessionsOf(column: number): number {
  return REQUIRED_SESSIONS[Math.trunc(column / 2)] ?? 0
}

/**
 * 횟수 · 단계를 쌓는 칸 — 열%2 칸, 단 **열 4(히든)는 그 행 cell0 단계가 2 가 아니면(≤ 1) cell1** 이다
 * (훈련 적용 0xa3cdc~0xa3cfa · 창 글 0x18454~0x18472 가 같은 식). 가드(0x17980)는 이 보정 없이 열%2 칸을 본다.
 */
export function pitchTrainingProgressCellOf(career: PitcherCareer, row: number, column: number): number {
  if (column === HIDDEN_PITCH_COLUMN && (career.pitchTrainingStages[row * 2] ?? 0) <= 1) return row * 2 + 1
  return pitchTrainingCellOf(row, column)
}

/** 칸의 훈련 횟수 — `커리어+0x208 + 칸·4` (s8). 옛 저장에는 칸이 없어 0 */
export function pitchTrainingCountOf(career: PitcherCareer, cell: number): number {
  return career.pitchTrainingCounts?.[cell] ?? 0
}

export interface PitchTrainingProgress {
  /** 적용 뒤 칸의 횟수 (다 차면 0 으로 돌아간다) */
  readonly sessions: number
  readonly required: number
  /** 적용 뒤 단계 > 열/2 — 창 글이 StrMODE[88] "구질 훈련 완료!" 로 간다 (0x184a6) */
  readonly isLearned: boolean
}

/** s8 칸 (ldrsb · strb) */
const toInt8 = (value: number) => ((value & 0xff) << 24) >> 24

/**
 * 확인에서 [예] → 125 → 훈련 0x17f5c 의 탭 2 갈래(0x1836a) → **훈련 적용 0xa3bac 종류 5**(0xa3cc8~0xa3d76, 직접 떴다):
 * ```
 * a3cca  필요 = 0xd80de[열/2] · 비용 = 0xd80d8[열/2] (s16 −300 · −600 · −1000)
 * a3cdc  칸 = 행·2 + 열%2 (열 4 는 cell0 단계 ≤ 1 이면 cell1)
 * a3d0c  횟수 = min(횟수 + 1, 필요) ; 횟수 == 필요면 횟수 = 0 · 단계 += 1
 * a3d3e  G = clamp(G + 비용, 0, 99999) → 전역 저장 · 0x22c29(모드 4 ? 1 : 2, |비용|)
 * ```
 * 곧 **한 번에 배우지 않는다** — 필요 횟수만큼 훈련해야 단계가 오르고, 훈련마다 G 를 낸다. 보유 마스크 `+0x1c` 는
 * 건드리지 않는다(경기 구질은 123 창 탭 2 가 마스크에 켠다 — `pitchSelection`). 사기 · 행동 · 훈련 수는
 * `runPitchTypeTraining`(0x17f5c 의 나머지)이 맡는다.
 */
export function applyPitchTypeTraining(
  career: PitcherCareer,
  row: number,
  column: number,
): { readonly career: PitcherCareer; readonly progress: PitchTrainingProgress } {
  const gate = pitchTrainingGateOf(career, row, column)
  if (gate.kind !== '확인') throw new Error(`구질 훈련을 할 수 없는 칸입니다 (행 ${row} 열 ${column})`)
  const required = pitchTrainingRequiredSessionsOf(column)
  const cell = pitchTrainingProgressCellOf(career, row, column)
  const counts = Array.from({ length: career.pitchTrainingStages.length }, (_, index) => pitchTrainingCountOf(career, index))
  const stages = [...career.pitchTrainingStages]
  const counted = toInt8(Math.min(toInt8(counts[cell] + 1), required))
  const isFilled = counted === required
  counts[cell] = isFilled ? 0 : counted
  if (isFilled) stages[cell] = toInt8((stages[cell] ?? 0) + 1)
  const trained: PitcherCareer = {
    ...career,
    gamePoint: Math.min(MAXIMUM_GAME_POINT, Math.max(0, career.gamePoint - gate.cost)),
    pitchTrainingStages: stages,
    pitchTrainingCounts: counts,
  }
  return {
    career: trained,
    progress: { sessions: counts[cell], required, isLearned: (stages[cell] ?? 0) > Math.trunc(column / 2) },
  }
}

/**
 * 히든 변화구 계열을 연다 — 이벤트 30~33 의 보상 종류 6(구질) 값이 **행 번호**다 (J 3-3).
 * 조건(능력치·연차)은 `pitcherAbility.HIDDEN_PITCH_EVENTS` 에 있다.
 */
export function openHiddenPitchRow(career: PitcherCareer, row: number): PitcherCareer {
  if (row < 0 || row >= PITCH_TRAINING_ROW_COUNT || career.hiddenPitchRows[row]) return career
  const rows = [...career.hiddenPitchRows]
  rows[row] = true
  return { ...career, hiddenPitchRows: rows }
}

/**
 * 지금 능력치·날짜로 열 수 있는 히든 계열 이벤트 — 관리 화면(trigger 0)이 보는 조건이다 (J 3-3).
 *
 * 날짜 창은 이벤트 판정 `0xacfbc` 의 8번(0xad110~0xad140)을 그대로 쓴다 — 타자편
 * `story/model/storyScene.isInDateWindow` 와 같은 식이다:
 * ```
 *   ad110: movs r0,#0x2d            ; 45
 *   ad112: muls r3,r0,r4 ; adds r3,r3,r2 ; subs r4,#0x2d   ; to   = 45·c + d − 45
 *   ad11e: muls r1,r0,r7 ; adds r1,r1,r5 ; subs r1,#0x2d   ; from = 45·a + b − 45
 *   ad124: [선수+0xb3]·45 + (s8)[선수+0xb2] + 1            ; now
 *   ad13a: cmp r1,r2 ; bgt 실패      ; from > now
 *   ad13e: cmp r4,r2 ; bge 통과      ; to  >= now
 * ```
 * ⚠️ 예전 판정은 `연차 == fromSeason && gamesPlayed < 9` 로 **한 경기 늦게** 열렸고
 * (5년차 8경기째가 이미 `now = 4·45+8+1 = 189 = from` 이라 원본에서는 통과한다),
 * 끝 날짜 **13년 45경기**를 아예 보지 않았다.
 */
export function openableHiddenPitchEventOf(career: PitcherCareer): (typeof HIDDEN_PITCH_EVENTS)[number] | null {
  const now = (career.season - 1) * GAMES_PER_SEASON + career.gamesPlayed + 1
  return (
    HIDDEN_PITCH_EVENTS.find((event) => {
      if (career.hiddenPitchRows[event.row]) return false
      const from = (event.dateFrom[0] - 1) * GAMES_PER_SEASON + event.dateFrom[1]
      const to = (event.dateTo[0] - 1) * GAMES_PER_SEASON + event.dateTo[1]
      if (now < from || now > to) return false
      return (
        career.ability.control >= event.control &&
        career.ability.velocity >= event.velocity &&
        career.ability.breaking >= event.breaking
      )
    }) ?? null
  )
}
