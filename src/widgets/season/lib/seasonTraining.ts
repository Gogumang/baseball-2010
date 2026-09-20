import { TEAM_ABILITY_LIMIT } from '@/entities/season-mode/model/seasonRecord'

/**
 * 시즌 팀 트레이닝 · 지옥훈련 (장면 0x105 상태 **0xcf**) 의 칸·가드·굴림 표.
 *
 * 근거: `docs/re/J-modes-rules.md` **4-6 절 확정** (가드 0x9108 · 굴림 0xc074 · 적용 0xa2f24),
 * `docs/re/R13-season-leftovers.md` 5 절(연출 0xde, 팝업 0x11·0x12·0x13),
 * `docs/re/P4-season-flow.md` 1b(관리 메뉴 칸 2) · 6 절(사기 변화 모음).
 *
 * ⚠️ **본래 자리는 `entities/season-mode/model` 이다.** 이번 작업은 `pages/season` ·
 * `widgets/season` 만 손대기로 되어 있어 여기 두었다 — 모델로 옮길 때 이 파일을 통째로
 * 옮기면 된다(화면은 표를 읽기만 하고 아무 규칙도 스스로 만들지 않는다).
 *
 * 굴림·적용(0xc074 → 0xa2f24)은 난수가 필요해 **여기서 하지 않는다** — 표만 둔다.
 * 부르는 쪽(모델)이 `TRAINING_*_RANGE` 를 그대로 써서 굴리면 된다.
 */

/** `bfa55(a, b)` 난수 = **[a, b)** — 표기는 문서와 같은 반열린 구간이다 */
export type TrainingRange = readonly [number, number]

/**
 * 팀 능력치 4칸 — 팀 레코드 `+4 · +6 · +8 · +0xa`, 글은 StrMODE[44]~[47] (J 4-6 · 177행).
 * 뜻은 StrHOWTO[19] "1. 팀 능력치": 투구 = 투수 구속·변화 / 타격 = 타자 히트·파워 /
 * 집중 = 투수 제구·타자 수비 / 근성 = 투수 체력·타자 주루.
 */
export const TEAM_ABILITY_LABELS = ['투구', '타격', '집중', '근성'] as const
export type TeamAbilityLabel = (typeof TEAM_ABILITY_LABELS)[number]

/** 트레이닝 5칸 — 칸 0~3 은 능력치, 칸 4 가 지옥훈련이다 (J 4-6) */
export const TRAINING_SLOTS = [...TEAM_ABILITY_LABELS, '지옥훈련'] as const
export type TrainingSlot = (typeof TRAINING_SLOTS)[number]

/** 지옥훈련 칸 번호 */
export const HELL_TRAINING_INDEX = 4
/** 지옥훈련 값 — StrMODE[141] "지옥훈련 500G". G 는 저장+0x64 (0xa2fca 의 리터럴 −500) */
export const HELL_TRAINING_GAME_POINT = 500

/**
 * ⚠️ **원본 그대로**: 가드는 `> 998` 로 막는데 적용은 `999`(= `TEAM_ABILITY_LIMIT`) 로 자른다.
 * 그래서 998 인 칸은 훈련이 되고 결과는 999 가 된다 — 한 칸이 비는 것이 아니라 원본이 그렇다.
 */
export const TRAINING_GUARD_CEILING = 998

/** 칸 0~3 — 상승 `bfa55(4,7)` = 4~6 */
export const TRAINING_GAIN_RANGE: TrainingRange = [4, 7]
/** 칸 0~3 — 사기 감소 `bfa55(6,9)` = 6~8 */
export const TRAINING_MORALE_LOSS_RANGE: TrainingRange = [6, 9]
/** 지옥훈련 — 네 능력치 각각 `bfa55(7,11)` = 7~10 (**네 번 따로 굴린다**) */
export const HELL_TRAINING_GAIN_RANGE: TrainingRange = [7, 11]
/** 지옥훈련 — 사기 감소 `bfa55(10,14)` = 10~13 */
export const HELL_TRAINING_MORALE_LOSS_RANGE: TrainingRange = [10, 14]

/**
 * 서브 아이템 보정 (J 4-6).
 * - `SR+0x58+칸` 이 있으면 그 칸 상승 **+2** (지옥훈련은 네 칸 각각) — StrITEM[218] "%s 훈련 시 +2"
 * - `SR+0x5c` 자동안마기면 사기 감소 **−1** — StrITEM[219] "훈련 시 사기 감소량 -1"
 */
export const TRAINING_SUB_ITEM_GAIN = 2
export const MASSAGER_MORALE_RELIEF = 1

/** 상승 뒤 자르는 값 — 모델의 `TEAM_ABILITY_LIMIT`(999) 과 같은 값이다 */
export const TRAINING_APPLY_LIMIT = TEAM_ABILITY_LIMIT

/** 가드가 거절하는 까닭 — 옆의 번호가 원본 StrMODE id 다 */
export type TrainingRefusal =
  | '사기없음' // [193] 사기 0
  | 'G부족' // [65] 지옥훈련 500G
  | '능력치최대' // [192] 능력치가 최대

export interface TrainingCheckInput {
  /** 팀 레코드 +4..+0xa — 투구·타격·집중·근성 차례 */
  readonly abilities: readonly number[]
  /** 팀 레코드 +2 (0~100) */
  readonly teamMorale: number
  /** 저장+0x64 G 포인트 — SR 이 아니라 **전역 저장** 칸이다 */
  readonly gamePoints: number
}

export interface TrainingCheckResult {
  readonly ok: boolean
  readonly reason?: TrainingRefusal
  /** 최대라서 걸린 능력치 이름들 — 지옥훈련 거절 글이 이 목록을 읽는다 */
  readonly maxedAbilities?: readonly TeamAbilityLabel[]
}

const OK: TrainingCheckResult = { ok: true }

/**
 * 트레이닝 가드 `0x9108` — **순서까지 원본 그대로** (J 4-6 확정).
 *
 * ```
 * 팀 사기(+2) == 0                      → StrMODE[193]
 * 칸 4(지옥훈련): G < 500                → StrMODE[65]
 *                네 능력치 중 > 998 인 것마다 "[x] 능력치가 최대" 목록
 *                넷 다 최대면 거절
 * 칸 0~3       : 그 능력치 > 998         → StrMODE[192]
 * ```
 * 칸 0~3 은 돈·G 를 쓰지 않는다.
 *
 * ⚠️ 지옥훈련은 **일부만 최대여도 그대로 진행**한다 — 문서가 "넷 다 최대면 거절" 이라
 * 적은 대로다. 최대인 칸에도 상승을 굴려 더한 뒤 999 로 잘리므로 그 칸은 헛돈다.
 * (일부만 최대일 때 원본이 목록 글을 띄우고도 진행하는지까지는 문서에 없다 — 여기서는
 *  목록만 돌려주고 화면이 알림으로 쓴다.)
 */
export function checkSeasonTraining(input: TrainingCheckInput, slot: number): TrainingCheckResult {
  if (input.teamMorale === 0) return { ok: false, reason: '사기없음' }

  const maxed = TEAM_ABILITY_LABELS.filter(
    (_, index) => (input.abilities[index] ?? 0) > TRAINING_GUARD_CEILING,
  )

  if (slot === HELL_TRAINING_INDEX) {
    if (input.gamePoints < HELL_TRAINING_GAME_POINT) return { ok: false, reason: 'G부족' }
    if (maxed.length === TEAM_ABILITY_LABELS.length) {
      return { ok: false, reason: '능력치최대', maxedAbilities: maxed }
    }
    return maxed.length === 0 ? OK : { ok: true, maxedAbilities: maxed }
  }

  const ability = input.abilities[slot]
  if (ability !== undefined && ability > TRAINING_GUARD_CEILING) {
    return { ok: false, reason: '능력치최대', maxedAbilities: [TEAM_ABILITY_LABELS[slot]] }
  }
  return OK
}
