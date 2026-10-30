import type { BatterAbility } from '@/entities/batting/model/batter'
import { derbyMasterBatterOf, type DerbyLineupBatter } from '@/entities/home-run-derby/model/derbyLineup'
import { batterCardStatsOf, batterLineOfRecord } from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupBatterCard } from '@/widgets/matchup-cards/ui/MatchupCards'
import type { DerbyPitcher } from '@/entities/home-run-derby/model/derbyPitcher'
import type { HomeRunDerbyScreenProps } from './derbyScreenProps'

/** 타석에 선 타자의 능력치 · 겉모습 · 장착 스킬 */
export interface DerbyStageBatter {
  readonly ability: BatterAbility
  readonly form: number | undefined
  readonly skinIndex: number | undefined
  readonly equipmentLevels: BatterAbility | undefined
  readonly skillIds: readonly number[] | undefined
}

/**
 * 지금 타자 0xae89c(팀 0) — 볼넷 · 사구 뒤 0xd 를 지나 타순이 넘어갔으면 내 팀 r7 의 마스터 타자 줄이 친다. 능력치(0xab214) ·
 * 장착 스킬(실투 0x33d52 등) · 그림(타석 교대 0x47cc8 이 다시 싣는다) · 소개 판 모두 그 줄 것이다. 모드 타자면 화면이 받은 선수다
 */
export function derbyStageBatterOf(batter: DerbyLineupBatter, props: HomeRunDerbyScreenProps): DerbyStageBatter {
  const master = batter.isModeBatter || batter.row === null ? null : derbyMasterBatterOf(batter.row)
  if (master === null) {
    return {
      ability: props.ability,
      form: props.batterForm,
      skinIndex: props.batterSkinIndex,
      equipmentLevels: props.batterEquipmentLevels,
      skillIds: props.batterSkillIds,
    }
  }
  return {
    ability: master.ability,
    form: master.form,
    skinIndex: master.skinIndex,
    equipmentLevels: master.equipmentLevels,
    skillIds: master.skillIds,
  }
}

/**
 * 소개 판 0x44944 의 타자 판 — 타순은 팀+0x32, 모드 타자의 수비는 0xb53f0 이 남긴 옛 [k] 줄의 것(`modeBatterPosition`).
 * 마스터 줄의 타율(0xb8e3c) · 홈런(+0x28) · 타점(+0x2a)은 그 줄의 시즌 칸 +0x20~ 이다 — 마스터 팀 적재 0x1ff98 이 팀 표 행을
 * 통째 베껴 표의 바이트 32~43 이 그대로 남는다(`RosterPlayer.recordLine`)
 */
export function derbyMatchupBatterOf(
  batter: DerbyLineupBatter,
  modeBatterPosition: number | undefined,
  matchupBatter: HomeRunDerbyScreenProps['matchupBatter'],
): Omit<MatchupBatterCard, 'isComputer'> {
  const masterRow = batter.isModeBatter ? null : batter.row
  const master = masterRow === null ? null : derbyMasterBatterOf(masterRow)
  if (master === null || masterRow === null) {
    return { ...matchupBatter, battingOrder: batter.order, ...(modeBatterPosition === undefined ? {} : { position: modeBatterPosition }) }
  }
  return {
    name: master.name,
    ...batterCardStatsOf(batterLineOfRecord(masterRow.recordLine)),
    battingOrder: batter.order,
    ...(master.position === undefined ? {} : { position: master.position }),
  }
}

/** 마운드 바탕 벌의 피부 — 마스터 줄 2 의 +0xb bit2~3 (482c0~482fc → 0x793b0 의 794c2, 벌 = 피부 × 15 + 수비 팀 v). 레코드가 없으면 0 */
export function derbyPitcherSkinIndexOf(pitcher: DerbyPitcher): number {
  return ((pitcher.record?.profile ?? 0) >> 2) & 3
}
