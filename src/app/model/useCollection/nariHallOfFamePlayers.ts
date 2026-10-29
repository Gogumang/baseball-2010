import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { equippedPitcherAbilityOf } from '@/entities/pitcher-career/model/pitcherCareer'
import { equippedAbilityOf } from '@/entities/career/model/condition'

/** 등록 목록 칸 0·5 에 그리는 나리 선수 — 이름과 능력치 도형 값 `0xb6415(기록, k, 1)` */
export interface NariHallOfFamePlayer {
  readonly name: string
  readonly equippedAbility: readonly number[]
  /**
   * A 자리 몸 그림 — 폼 rec[0xb]>>4(2 × 타입 + 손) · 피부 · 장비 니블 넷 · **나리 저장의 팀**
   * (목록 +0x4c4 · +0x4c0 = `0x1f8d5(저장, 3|4)+1`, 0x5ec0a · 0x5ec60). `pages/special` HallOfFameNariPlayer.figure
   */
  readonly figure: {
    readonly form: number
    readonly skin: number
    readonly team: number
    readonly equipment: readonly [number, number, number, number]
  }
}

/** 칸 0 나리 투수 (0x5eb8c — 투수편 저장 g+0x43 · 0x1fbd0). k = 0 제구 · 1 구속 · 2 변화 · 3 체력 */
export function nariPitcherOf(career: PitcherCareer | null | undefined): NariHallOfFamePlayer | null {
  if (career === null || career === undefined) return null
  const ability = equippedPitcherAbilityOf(career)
  const nibbles = career.equipmentLevels
  return {
    name: career.name,
    equippedAbility: [ability.control, ability.velocity, ability.breaking, ability.stamina],
    figure: {
      form: career.typeIndex * 2 + career.handIndex,
      skin: career.skinIndex,
      team: career.teamId,
      equipment: [nibbles.control, nibbles.velocity, nibbles.breaking, nibbles.stamina],
    },
  }
}

/** 칸 5 나리 타자 (0x5eb8c — 타자편 저장 g+0x44 · 0x1fc20). k = 0 히트 · 1 파워 · 2 수비 · 3 주루 */
export function nariBatterOf(career: PlayerCareer | null | undefined): NariHallOfFamePlayer | null {
  if (career === null || career === undefined) return null
  const ability = equippedAbilityOf(career)
  const nibbles = career.equipmentLevels
  return {
    name: career.name,
    equippedAbility: [ability.hit, ability.power, ability.defense, ability.run],
    figure: {
      form: career.battingTypeIndex * 2 + career.battingSide,
      skin: career.skinIndex,
      team: career.teamId,
      equipment: [nibbles.hit, nibbles.power, nibbles.defense, nibbles.run],
    },
  }
}
