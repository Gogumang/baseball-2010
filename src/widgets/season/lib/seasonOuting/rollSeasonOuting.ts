import { cureIllnessAtHospital } from '@/entities/season-mode/model/seasonEventFlow'
import { MONEY_LIMIT, MORALE_LIMIT, POPULARITY_LIMIT, REPUTATION_LIMIT, type SeasonRecord, clampTo } from '@/entities/season-mode/model/seasonRecord'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { seasonOutingResultTextOf } from '@/widgets/season/lib/seasonOuting/outingResultText'
import {
  HOSPITAL_PLACE,
  type OutingRange,
  SEASON_OUTING_EFFECTS,
  SEASON_OUTING_SUB_ITEMS,
  type SeasonOutingEffect,
  type SeasonOutingSubItemBonus,
} from '@/widgets/season/lib/seasonOuting/outingTables'

/** 외출 한 번을 굴리고 적용한 결과 (`0xc81c`) */
export interface SeasonOutingOutcome {
  readonly record: SeasonRecord
  readonly teamMorale: number
  /** 결과 팝업 id **0x17** 글 — 0xc9a8~0xcd76 이 지은 원문 마크업 (`seasonOutingResultTextOf`) */
  readonly text: string
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
export function rollSeasonOuting(record: SeasonRecord, teamMorale: number, place: number, random: RandomPort): SeasonOutingOutcome | null {
  const effect = SEASON_OUTING_EFFECTS[place]
  if (effect === undefined) return null
  const hasSubItem = record.outingSubItems[place] === true
  const bonus = outingBonusOf(hasSubItem ? SEASON_OUTING_SUB_ITEMS[place] : undefined)
  const rolls = rollOutingEffect(effect, random)
  const applied = applyOutingGains(record, rolls, bonus)
  const cure = rollHospitalCure(place, applied, random)
  const text = seasonOutingResultTextOf(
    [
      { label: 22, rolled: rolls.popularity, bonus: bonus.popularity },
      { label: 23, rolled: rolls.reputation, bonus: bonus.reputation },
    ],
    { label: 25, rolled: rolls.money, bonus: bonus.money },
    { label: 24, rolled: rolls.morale, bonus: bonus.morale },
    // 글은 치료 전 질병 SR+5 로 짓는다(0xccba) — 그 뒤에 SR+5 = 0
    cure?.cured === true ? record.illness : null,
    hasSubItem ? place : null,
  )
  return {
    record: cure?.record ?? applied,
    teamMorale: clampTo(teamMorale + rolls.morale + bonus.morale, MORALE_LIMIT),
    text,
  }
}

/** 외출 굴림 — 사기 → 소지금(p0) → 인기도(p3 · p4) → 평판(p3) 차례 (c84e · c8c8) */
interface OutingRolls {
  readonly morale: number
  readonly money: number
  readonly popularity: number
  readonly reputation: number
}

/** c84e 사기 굴림(p0 · p3 은 c8b0 에서 부호를 뒤집는다) 뒤 c8c8 의 장소별 굴림 — 차례를 바꾸지 말 것 */
function rollOutingEffect(effect: SeasonOutingEffect, random: RandomPort): OutingRolls {
  const rolled = random.rand(effect.moraleRange[0], effect.moraleRange[1])
  const morale = effect.negatesMorale ? -rolled : rolled
  const money = rollOutingRange(effect.moneyRange, effect.money, random)
  const popularity = rollOutingRange(effect.popularityRange, 0, random)
  const reputation = rollOutingRange(effect.reputationRange, 0, random)
  return { morale, money, popularity, reputation }
}

/** 범위가 있으면 rand(a, b), 없으면 정한 값 (굴리지 않는다) */
function rollOutingRange(range: OutingRange | undefined, fixed: number, random: RandomPort): number {
  return range === undefined ? fixed : random.rand(range[0], range[1])
}

/** 서브 아이템 보정 (점프표 0xcbe6c — 모두 0 으로 시작). 아이템이 없으면 모두 0 */
function outingBonusOf(bonus: SeasonOutingSubItemBonus | undefined): OutingRolls {
  if (bonus === undefined) return NO_OUTING_BONUS
  return { morale: bonus.morale ?? 0, money: bonus.money ?? 0, popularity: bonus.popularity ?? 0, reputation: bonus.reputation ?? 0 }
}

const NO_OUTING_BONUS: OutingRolls = { morale: 0, money: 0, popularity: 0, reputation: 0 }

/** c902~c952 — 인기도 SR+0x48(0..9999) · 평판 SR+0x62(0..999) · 소지금 SR+2(0..9999) 에 굴림 + 보정 */
function applyOutingGains(record: SeasonRecord, rolls: OutingRolls, bonus: OutingRolls): SeasonRecord {
  return {
    ...record,
    popularity: clampTo(record.popularity + rolls.popularity + bonus.popularity, POPULARITY_LIMIT),
    reputation: clampTo(record.reputation + rolls.reputation + bonus.reputation, REPUTATION_LIMIT),
    money: clampTo(record.money + rolls.money + bonus.money, MONEY_LIMIT),
  }
}

/** 입원(장소 2)이면 치료를 굴린다 — `rand(0,101) ≤ 89` 이거나 여유 칸이 0 이면 낫는다 (0xcc6a). 다른 장소는 굴리지 않는다 */
function rollHospitalCure(place: number, applied: SeasonRecord, random: RandomPort): ReturnType<typeof cureIllnessAtHospital> | null {
  return place === HOSPITAL_PLACE ? cureIllnessAtHospital(applied, random) : null
}
