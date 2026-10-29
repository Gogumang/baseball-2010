import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { isBugFixed } from '@/shared/config/bugfixes'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import {
  HOSPITAL_PLACE,
  SEASON_OUTING_ACTIVITIES,
  SEASON_OUTING_COSTS,
  SEASON_OUTING_REQUIRED_POPULARITY,
  SEASON_OUTING_SUB_ITEMS,
} from '@/widgets/season/lib/seasonOuting/outingTables'
import { seasonMoneyTextOf } from '@/widgets/season/lib/seasonText'

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
 * ⚠️ **원본 버그(B-25)**: 2번 소지금 검사가 **서브 아이템을 보지 않는다** — 고친 길(기본)은 `seasonOutingMoneyCostOf`.
 * 병원 서브 아이템(`SR+0x5f`, StrITEM[222] "소지금 감소없음")을 가졌어도 소지금이 5(=500만)
 * 미만이면 입원이 막힌다. 나리 쪽 같은 버그(보험증서, G 3-2 `0x16d42`)가 DECISIONS.md 의
 * "원본 버그도 그대로 이식" 목록에 올라가 있다.
 */
export function checkSeasonOuting(record: SeasonRecord, teamMorale: number, place: number): SeasonOutingCheckResult {
  const cost = SEASON_OUTING_COSTS[place] ?? 0
  const refusal = seasonOutingRefusalOf(record, teamMorale, place, cost)
  return refusal === null ? { ok: true, cost } : { ok: false, ...refusal, cost }
}

/** 가드 1~4 를 차례로 — 처음 걸린 까닭(인기도면 필요한 값까지), 다 지나면 null */
function seasonOutingRefusalOf(
  record: SeasonRecord,
  teamMorale: number,
  place: number,
  cost: number,
): Pick<SeasonOutingCheckResult, 'reason' | 'required'> | null {
  const required = missingPopularityOf(record, place)
  if (required !== null) return { reason: '인기도부족', required }
  // ⚠️ 원본은 서브 아이템을 보지 않는다 (B-25). 고친 길은 서브 아이템 소지금 보정을 먹인 실제 비용으로 견준다
  if (record.money < seasonOutingMoneyCostOf(record, place, cost)) return { reason: '소지금부족' }
  if (place === HOSPITAL_PLACE && record.illness === 0) return { reason: '질병없음' }
  if (place === PARTY_PLACE && teamMorale === MORALE_FULL) return { reason: '사기최고' }
  return null
}

/** 장소 1 = 번화가 [회식] */
const PARTY_PLACE = 1

/** 가드 1 — p0 · p4 의 필요 인기도에 못 미치면 그 값, 아니면 null */
function missingPopularityOf(record: SeasonRecord, place: number): number | null {
  const required = SEASON_OUTING_REQUIRED_POPULARITY[place] ?? 0
  return required > 0 && record.popularity < required ? required : null
}

/**
 * 소지금 검사가 보는 비용 — 원본(0xbd38 2번)은 표 비용 c 그대로다.
 * **B-25 고침**: 결과 0xc81c 가 실제로 쓰는 값 `c − 서브 아이템 소지금 보정(SR+0x5d+p)` 으로 견준다(병원 5 − 5 = 0 → 늘 들어간다).
 * 굴림 없는 판정이라 난수 차례는 같다. 확인 팝업의 비용 줄은 원본 글 그대로다
 */
function seasonOutingMoneyCostOf(record: SeasonRecord, place: number, cost: number): number {
  if (!isBugFixed('B-25') || record.outingSubItems[place] !== true) return cost
  return Math.max(0, cost - (SEASON_OUTING_SUB_ITEMS[place]?.money ?? 0))
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
  const text = ORIGINAL_MODE_TEXT[REFUSAL_TEXT_IDS[check.reason ?? '소지금부족']] ?? ''
  return check.reason === '인기도부족' ? text.replace('%d', String(check.required ?? 0)) : text
}

/** 거절 까닭 → StrMODE 번호 (까닭이 없으면 [77]) */
const REFUSAL_TEXT_IDS: Readonly<Record<SeasonOutingRefusal, number>> = {
  인기도부족: 62,
  소지금부족: 77,
  질병없음: 196,
  사기최고: 91,
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
