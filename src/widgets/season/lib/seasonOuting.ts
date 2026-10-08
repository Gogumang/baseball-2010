import type { RandomPort } from '@/shared/api/random/randomPort'
import { SCHEDULE_ACTIVITIES } from '@/shared/config/original/modeMenus'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { seasonMoneyTextOf } from '@/widgets/season/lib/seasonText'
import {
  MONEY_LIMIT, MORALE_LIMIT, POPULARITY_LIMIT, REPUTATION_LIMIT, clampTo,
} from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { cureIllnessAtHospital } from '@/entities/season-mode/model/seasonEventFlow'

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
 * 여기 두었다. 굴림·적용(`rollSeasonOuting`)은 난수를 받아서 한다.
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

/**
 * 가드 `0xbd38` 의 거절 팝업 글 (id 1) — 원문 그대로 (직접 떴다).
 * ```
 * bd6a  [62]  sprintf(StrMODE[62], 200 | 400)
 * bdbc  [77]  sprintf(StrMODE[77], c × 100)   ; 서식 칸이 없어 원문 그대로 나온다
 * be6e  [196] · bea2 [91]  원문 그대로
 * ```
 */
export function seasonOutingRefusalTextOf(check: SeasonOutingCheckResult): string {
  switch (check.reason) {
    case '인기도부족':
      return (ORIGINAL_MODE_TEXT[62] ?? '').replace('%d', String(check.required ?? 0))
    case '질병없음':
      return ORIGINAL_MODE_TEXT[196] ?? ''
    case '사기최고':
      return ORIGINAL_MODE_TEXT[91] ?? ''
    default:
      return ORIGINAL_MODE_TEXT[77] ?? ''
  }
}

/**
 * 확인 팝업 id **0x16** 글 (`0xbd38` 의 0xbdf8~0xbf00, 직접 떴다) — **비용 줄이 먼저**다.
 * ```
 * bdf8  글 = "!C"
 * be02  c > 0 이면 글 += sprintf(StrMODE[162], 0x55cf4(c × 100)) + "!N"
 * beb0  글 += sprintf(StrMODE[161], StrMODE[54 + p])
 * ```
 * [162] 도 "!C" 로 시작하고 [161] 은 원문 안에 "!N" 이 있다.
 */
export function seasonOutingConfirmTextOf(place: number): string {
  const cost = SEASON_OUTING_COSTS[place] ?? 0
  const costLine = cost > 0 ? `${(ORIGINAL_MODE_TEXT[162] ?? '').replace('%s', seasonMoneyTextOf(cost))}!N` : ''
  return `!C${costLine}${(ORIGINAL_MODE_TEXT[161] ?? '').replace('%s', SEASON_OUTING_ACTIVITIES[place] ?? '')}`
}

/** 외출 한 번을 굴리고 적용한 결과 (`0xc81c`) */
export interface SeasonOutingOutcome {
  readonly record: SeasonRecord
  readonly teamMorale: number
  /** 결과 팝업 id **0x17** 글 — 0xc9a8~0xcd76 이 지은 원문 마크업 (`seasonOutingResultTextOf`) */
  readonly text: string
}

/** 결과 글 한 줄의 재료 — 굴린 값(부호 · 줄 여부)과 서브 아이템 보정 */
interface OutingLine {
  readonly label: number
  readonly rolled: number
  readonly bonus: number
}

/** 0xc9e4~0xca14 — "(" + ("+" | "-") + |보정| + ")" */
const bonusTextOf = (bonus: number, scale: number): string =>
  bonus === 0 ? '' : `(${bonus > 0 ? '+' : '-'}${Math.abs(bonus * scale)})`

/** [83] 상승 · [84] 하락 — 굴린 값의 부호로 고른다(보정을 더한 값이 아니다) */
const riseTextOf = (rolled: number): string => ORIGINAL_MODE_TEXT[rolled >= 0 ? 83 : 84] ?? ''

/**
 * 결과 팝업 0x17 글 (0xc9a8~0xcd76, 직접 떴다). 글 상자는 "!C" 로 시작한다(0xc822).
 * ```
 * c9a8  인기도 굴림 ≠ 0:  [22] + " " + |굴림 + 보정| + 보정글 + ([83] | [84]) + "!N"
 * ca40  평판 굴림 ≠ 0:    [23] + " " + |굴림 + 보정| + 보정글 + ([83] | [84]) + "!N"
 * cada  소지금 기본 ≠ 0:  [25] + " " + |기본 + 보정| × 100 + "만" + 보정글(×100) + ([83] | [84]) + "!N"
 * cbd4  사기 m ≠ 0:       [24] + " " + |m + 보정| + 보정글 + ([83] | [84])            ; 끝 "!N" 없음
 * cc6a  p == 2 이고 나았으면: "!N" "!N" + sprintf([206], StrMODE[185 + 질병 SR+5])
 * cd0c  서브 아이템이 있으면: "!N" "!N" "!cFFFF00" + StrITEM[114 + p] + " " + StrMODE[195]
 * ```
 * 줄 여부와 [83]/[84] 는 **굴린 값**을 보고, 숫자는 보정을 더한 절댓값이다 — 서브 아이템 병원의 소지금은
 * 기본 −5 + 5 = 0 이라 "소지금 0만(+500)하락" 이 된다(원본 그대로). "만" 은 보정글 앞에 붙는다.
 */
function seasonOutingResultTextOf(
  lines: readonly OutingLine[],
  money: OutingLine,
  morale: OutingLine,
  curedIllness: number | null,
  subItemPlace: number | null,
): string {
  let text = '!C'
  for (const line of lines) {
    if (line.rolled === 0) continue
    text += `${ORIGINAL_MODE_TEXT[line.label] ?? ''} ${Math.abs(line.rolled + line.bonus)}${bonusTextOf(line.bonus, 1)}${riseTextOf(line.rolled)}!N`
  }
  if (money.rolled !== 0) {
    text += `${ORIGINAL_MODE_TEXT[money.label] ?? ''} ${Math.abs(money.rolled + money.bonus) * 100}만${bonusTextOf(money.bonus, 100)}${riseTextOf(money.rolled)}!N`
  }
  if (morale.rolled !== 0) {
    text += `${ORIGINAL_MODE_TEXT[morale.label] ?? ''} ${Math.abs(morale.rolled + morale.bonus)}${bonusTextOf(morale.bonus, 1)}${riseTextOf(morale.rolled)}`
  }
  if (curedIllness !== null) {
    text += `!N!N${(ORIGINAL_MODE_TEXT[206] ?? '').replace('%s', ORIGINAL_MODE_TEXT[185 + curedIllness] ?? '')}`
  }
  if (subItemPlace !== null) {
    text += `!N!N!cFFFF00${ORIGINAL_ITEMS[114 + subItemPlace] ?? ''} ${ORIGINAL_MODE_TEXT[195] ?? ''}`
  }
  return text
}

/**
 * **외출 결과 `0xc81c`** — 굴림 · 서브 아이템 보정 · 적용 · 입원 치료 (직접 떴다).
 *
 * ```
 * c84e  m = rand(0xcbbf6[2p], 0xcbbf6[2p+1])           ; 사기 굴림 — 늘 먼저
 * c86a  SR+0x5d+p ≠ 0 이면 점프표 0xcbe6c[p]:            ; 서브 아이템 보정 (모두 0 으로 시작)
 *         p0 소지금 +5 · p1 사기 +4 · p2 소지금 +5 · 사기 +1 · p3 인기도 +1 · 평판 +1 · p4 인기도 +2
 * c8b0  p == 0 · 3 이면 m = −m                          ; 보정은 뒤집지 않는다
 * c8c8  p0 소지금 = rand(8, 11) · p3 인기도 = rand(1, 4) → 평판 = rand(3, 6) · p4 인기도 = rand(4, 7)
 * c902  인기도 SR+0x48 = clamp(인기도 + 굴림 + 보정, 0, 9999)
 * c92c  평판 SR+0x62   = clamp(평판 + 굴림 + 보정, 0, 999)
 * c952  소지금 SR+2    = clamp(소지금 + 기본(0xcbc00[p] · p0 은 굴림) + 보정, 0, 9999)
 * c96a  팀 사기 +2     = clamp(사기 + m + 보정, 0, 100)
 * cc6a  p == 2 이면 치료 굴림 (`cureIllnessAtHospital`)
 * ```
 * 보유 플래그는 `SeasonRecord.outingSubItems[p]` (SR+0x5d+p).
 */
export function rollSeasonOuting(
  record: SeasonRecord,
  teamMorale: number,
  place: number,
  random: RandomPort,
): SeasonOutingOutcome | null {
  const effect = SEASON_OUTING_EFFECTS[place]
  if (effect === undefined) return null
  const bonus = record.outingSubItems[place] === true ? SEASON_OUTING_SUB_ITEMS[place] : undefined

  const rolled = random.rand(effect.moraleRange[0], effect.moraleRange[1])
  const morale = effect.negatesMorale ? -rolled : rolled
  const money = effect.moneyRange === undefined ? effect.money : random.rand(effect.moneyRange[0], effect.moneyRange[1])
  const popularity = effect.popularityRange === undefined ? 0 : random.rand(effect.popularityRange[0], effect.popularityRange[1])
  const reputation = effect.reputationRange === undefined ? 0 : random.rand(effect.reputationRange[0], effect.reputationRange[1])

  const applied: SeasonRecord = {
    ...record,
    popularity: clampTo(record.popularity + popularity + (bonus?.popularity ?? 0), POPULARITY_LIMIT),
    reputation: clampTo(record.reputation + reputation + (bonus?.reputation ?? 0), REPUTATION_LIMIT),
    money: clampTo(record.money + money + (bonus?.money ?? 0), MONEY_LIMIT),
  }
  // 입원(장소 2)이면 치료를 굴린다 — `rand(0,101) ≤ 89` 이거나 여유 칸이 0 이면 낫는다 (0xcc6a)
  const cure = place === HOSPITAL_PLACE ? cureIllnessAtHospital(applied, random) : null
  const text = seasonOutingResultTextOf(
    [
      { label: 22, rolled: popularity, bonus: bonus?.popularity ?? 0 },
      { label: 23, rolled: reputation, bonus: bonus?.reputation ?? 0 },
    ],
    { label: 25, rolled: money, bonus: bonus?.money ?? 0 },
    { label: 24, rolled: morale, bonus: bonus?.morale ?? 0 },
    // 글은 치료 전 질병 SR+5 로 짓는다(0xccba) — 그 뒤에 SR+5 = 0
    cure?.cured === true ? record.illness : null,
    bonus === undefined ? null : place,
  )
  return {
    record: cure?.record ?? applied,
    teamMorale: clampTo(teamMorale + morale + (bonus?.morale ?? 0), MORALE_LIMIT),
    text,
  }
}

/** 장소 2 = 병원 [입원] */
const HOSPITAL_PLACE = 2
