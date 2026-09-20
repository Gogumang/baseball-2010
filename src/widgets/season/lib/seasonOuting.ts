import { SCHEDULE_ACTIVITIES } from '@/shared/config/original/modeMenus'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'

/**
 * 시즌 외출 5종 (장면 0x105 상태 **0xd1** 지도 → 가드 0xbd38 → 결과 0xc81c) 의 표.
 *
 * 근거: `docs/re/P4-season-flow.md` **3 절 확정** (가드·비용·효과표·입원 치료),
 * 6 절(사기 변화 모음) · `docs/re/G-management-numbers.md` 171행(서브 아이템 점프표).
 *
 * ⚠️ **나만의리그 외출(`shared/config/outingPlaces.ts`)과 값·가드가 다르다 — 절대 재사용 금지.**
 * P4 3절·7절이 못 박은 것이다: 인기도 조건이 p0·p4 에만 있고 값도 다르며, 시즌 팀에는
 * 부상 개념이 없어 부상 검사가 없다.
 *
 * ⚠️ **본래 자리는 `entities/season-mode/model` 이다** — 이번 작업의 담당 폴더가 아니라
 * 여기 두었다. 굴림·적용은 난수가 필요해 여기서 하지 않는다(표와 가드만).
 */

/** `rand(a, b)` = **[a, b)**. 문서의 "14~18" 은 `[14, 19)` 다 */
export type OutingRange = readonly [number, number]

/** 장소 p = `this+0xf8` (P4 3절) */
export const SEASON_OUTING_PLACES = ['경기장', '번화가', '병원', '학교', '방송국'] as const
export type SeasonOutingPlace = (typeof SEASON_OUTING_PLACES)[number]

/**
 * 장소별 기능 이름 = **StrMODE[54 + p]** = 친선경기·회식·입원·야구교실·구단CF.
 * 웹 생성표 `SCHEDULE_ACTIVITIES` 는 앞 5개가 나리(팬미팅·외식·…), **뒤 5개가 시즌**이다.
 */
export const SEASON_OUTING_ACTIVITIES: readonly string[] = SCHEDULE_ACTIVITIES.slice(5)

/** 각 칸이 StrHOWTO[22] "외출 커맨드"(시즌 쪽) 에서 설명하는 방향 */
export const SEASON_OUTING_DESCRIPTIONS: readonly string[] = [
  '친선경기를 통해 소지금을 획득합니다',
  '회식을 통해 사기를 대폭 회복합니다. 단, 소지금을 소모합니다',
  '입원을 통해 부상, 질병을 회복시키고, 소량의 사기를 회복합니다. 단, 소지금을 소모합니다',
  '야구교실을 통해 인기도와 평판이 상승합니다',
  '구단CF을 통해 인기도 상승과 소량의 사기를 회복합니다. 단, 소지금을 소모합니다',
]

/**
 * 비용 (100만 원 단위) — 가드 `0xbd38` 2번이 읽는 값. p1 **4** · p2 **5** · p4 **10**,
 * p0·p3 은 0 이다. 효과표의 소지금 기본값과 부호만 다른 같은 값이다.
 */
export const SEASON_OUTING_COSTS: readonly number[] = [0, 4, 5, 0, 10]

/**
 * 필요 인기도 — **p0 친선경기 200 · p4 구단CF 400 뿐**이다 (StrMODE[62]).
 * 나머지 장소에는 인기도 조건이 없다 (나리 쪽과 다른 점).
 */
export const SEASON_OUTING_REQUIRED_POPULARITY: readonly number[] = [200, 0, 0, 0, 400]

/**
 * 효과표 `0xc81c` (P4 3절 확정). 난수 순서는 **사기 → (p0 소지금 | p3 인기도 → 평판 | p4 인기도)**.
 *
 * - `morale` 은 `0xcbbf6` s8 의 [a, b) 이고, **p0·p3 은 부호를 뒤집는다**(0xc8b0).
 * - `money` 는 `0xcbc00` s16 기본값. p0 만 난수(`rand(8,11)`)라 `moneyRange` 로 따로 뒀다.
 * - 적용 자리: 인기도 SR+0x48(0..9999) · 평판 SR+0x62(0..999) · 소지금 SR+2(0..9999) ·
 *   팀 사기 = **팀 레코드 +2**(0..100).
 */
export interface SeasonOutingEffect {
  /** 사기 난수 [a, b) — `negatesMorale` 이면 뺀다 */
  readonly moraleRange: OutingRange
  /** ⚠️ p0 친선경기·p3 야구교실은 사기 난수의 **부호를 뒤집는다** (0xc8b0) */
  readonly negatesMorale: boolean
  /** 소지금 정액 변화 (100만 단위). p0 은 `moneyRange` 를 굴린다 */
  readonly money: number
  readonly moneyRange?: OutingRange
  readonly popularityRange?: OutingRange
  readonly reputationRange?: OutingRange
}

export const SEASON_OUTING_EFFECTS: readonly SeasonOutingEffect[] = [
  // 0 친선경기 — 사기 −(14~18) · 소지금 +(8~10)
  { moraleRange: [14, 19], negatesMorale: true, money: 0, moneyRange: [8, 11] },
  // 1 회식 — 사기 +25~30 · 소지금 −4
  { moraleRange: [25, 31], negatesMorale: false, money: -4 },
  // 2 입원 — 사기 +3~5 · 소지금 −5 (+ 질병 치료 굴림 0xcc6a)
  { moraleRange: [3, 6], negatesMorale: false, money: -5 },
  // 3 야구교실 — 사기 −(8~10) · 인기도 +1~3 · 평판 +3~5
  { moraleRange: [8, 11], negatesMorale: true, money: 0, popularityRange: [1, 4], reputationRange: [3, 6] },
  // 4 구단CF — 사기 +2(`rand(2,3)`) · 소지금 −10 · 인기도 +4~6
  { moraleRange: [2, 3], negatesMorale: false, money: -10, popularityRange: [4, 7] },
]

/**
 * 서브 아이템 보너스 (`SR+0x5d+p`, 점프표 `0xcbe6c`) — StrITEM[220]~[224] 와 같다.
 * **부호 뒤집기 뒤에** 더한다 (P4 3절 · G 171행).
 *
 * 보유 플래그는 모델의 `SeasonRecord.outingSubItems` 다. 서브아이템 상점은 이 칸들을
 * `rec[0x58 + 줄×5 + 칸]` 2×5 격자로 다루고(R12), **외출 쪽이 두 번째 줄 `+0x5d`~`+0x61`** 이다.
 */
export interface SeasonOutingSubItemBonus {
  readonly money?: number
  readonly morale?: number
  readonly popularity?: number
  readonly reputation?: number
  /** StrITEM[220+p] 원문 그대로의 설명 */
  readonly text: string
}

export const SEASON_OUTING_SUB_ITEMS: readonly SeasonOutingSubItemBonus[] = [
  { money: 5, text: '경기장 [친선경기] 시 소지금 +500만' },
  { morale: 4, text: '번화가 [회식] 시 사기회복 +4' },
  { money: 5, morale: 1, text: '병원 [입원] 시 소지금 감소없음 / 사기회복 +1' },
  { popularity: 1, reputation: 1, text: '학교 [야구교실] 시 인기도 +1 / 평판 +1' },
  { popularity: 2, text: '방송국 [구단CF] 시 인기도 +2' },
]

/** 가드가 거절하는 까닭 — 옆 번호가 원본 StrMODE id 다 */
export type SeasonOutingRefusal =
  | '인기도부족' // [62] (p0 200 · p4 400)
  | '소지금부족' // [77]
  | '질병없음' // [196] "건강한 상태입니다 입원할 필요가 없습니다"
  | '사기최고' // [91] "사기 최고 상태입니다"

export interface SeasonOutingCheckResult {
  readonly ok: boolean
  readonly reason?: SeasonOutingRefusal
  /** 인기도가 모자랄 때 필요한 값 */
  readonly required?: number
  /** 이 장소의 비용 (100만 단위, 0 이면 공짜) */
  readonly cost: number
}

/** 팀 사기 최고값 — 회식 가드가 보는 값 (팀 레코드 +2 는 0..100) */
const MORALE_FULL = 100

/**
 * 외출 가드 `0xbd38` — **순서까지 원본 그대로** (P4 3절 확정).
 *
 * ```
 * 1. p0 인기도 < 200 → [62](200) / p4 인기도 < 400 → [62](400)
 * 2. 비용 c > 소지금 SR+2         → [77]
 * 3. p2 입원인데 SR+5 == 0(건강)  → [196]
 * 4. p1 회식인데 팀 사기 == 100   → [91]
 * ```
 * 부상 검사는 없다 — 시즌 팀에는 부상 개념이 없다.
 *
 * ⚠️ **원본 버그 그대로**: 2번 소지금 검사가 **서브 아이템을 보지 않는다.**
 * 병원 서브 아이템(`SR+0x5f`, StrITEM[222] "소지금 감소없음")을 가졌어도 소지금이 5(=500만)
 * 미만이면 입원이 막힌다. 나리 쪽 같은 버그(보험증서, G 3-2 `0x16d42`)가 DECISIONS.md 의
 * "원본 버그도 그대로 이식" 목록에 올라가 있다.
 */
export function checkSeasonOuting(
  record: SeasonRecord,
  teamMorale: number,
  place: number,
): SeasonOutingCheckResult {
  const cost = SEASON_OUTING_COSTS[place] ?? 0
  const required = SEASON_OUTING_REQUIRED_POPULARITY[place] ?? 0

  if (required > 0 && record.popularity < required) {
    return { ok: false, reason: '인기도부족', required, cost }
  }
  // ⚠️ 서브 아이템을 보지 않는다 — 원본 그대로
  if (record.money < cost) return { ok: false, reason: '소지금부족', cost }
  if (place === 2 && record.illness === 0) return { ok: false, reason: '질병없음', cost }
  if (place === 1 && teamMorale === MORALE_FULL) return { ok: false, reason: '사기최고', cost }

  return { ok: true, cost }
}
