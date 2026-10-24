/**
 * 한 경기의 **선수 · 수비 그림 미리 받기 목록** — 타석(`stageSpritePreload`)과 수비 화면(`defenseSpritePreload`)을 합친다.
 *
 * 경기 진입 때 두 팀 명단에서 아는 것(실린 마선수 · 사람 선수의 몸통 폼과 장비)을 넘기면 그 그림까지 받는다.
 * 일반 타자 몸통 폼은 상대 명단을 몰라도 빠지지 않게 늘 둘 다 받는다(타격형 · 장타형 두 벌뿐이다).
 */
import type { GameAceSetup } from '@/features/play-game/model/gameAces'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { defenseEntrySpritePreloadsOf, defenseSpritePreloadsOf } from '@/pages/defense/lib/defenseSpritePreload'
import { mergeSpritePreloads } from '@/shared/lib/sprite/spritePreload'
import type { SpriteFolderPreload } from '@/shared/lib/sprite/spritePreload'
import { batterEquipmentOf, bodyTypeOf, pitcherEquipmentOfNibbles } from '@/widgets/batting-stage/lib/batterLayers'
import { teamBatters } from '@/entities/team/model/teamRoster'
import type { TeamRecordEquipment } from '@/entities/team/model/teamRoster'
import { stageCastSpritePreloadsOf, stageEntrySpritePreloadsOf } from '@/widgets/batting-stage/lib/stageSpritePreload'
import type { StageCast } from '@/widgets/batting-stage/lib/stageSpritePreload'

/** 두 팀의 마선수 → 타석 출연진 */
export function castOfAces(aces: GameAceSetup | undefined): StageCast {
  if (aces === undefined) return {}
  return {
    aceBatters: [aces.ours.batter, aces.opponent.batter].filter((order) => order >= 0),
    acePitchers: [aces.ours.pitcher, aces.opponent.pitcher].filter((order) => order >= 0),
  }
}

/** 나리 타자편 사람 선수 — 몸통 폼(타입 · 손으로 만든 폼)과 장착 장비 */
export function castOfCareer(career: Pick<PlayerCareer, 'battingTypeIndex' | 'battingSide' | 'equipmentLevels'>): StageCast {
  const bodyType = bodyTypeOf(career.battingTypeIndex * 2 + career.battingSide)
  return { equippedBatters: [{ bodyType, equipment: batterEquipmentOf(career.equipmentLevels) }] }
}

/**
 * CPU 팀 레코드의 **굴린 장비 니블**(나리 새 시즌 0x665e8 — `nariTeamRecordEquipmentOf`) → 타석 출연진.
 * 타석 교대 0x47cc8 이 타자(47e80~47eb6 → 0x78fd8) · 마운드 투수(48138~4816a → 0x79790)에 레코드 니블 − 1 로 장비 겹을 싣는다
 * — 모드를 가리지 않으므로 상대 팀의 굴린 줄은 경기 중 언제든 선다. 타자 몸통 폼은 그 붙박이 표 칸의 Xls `+0xb >> 4`.
 * 덮개가 없으면(첫 시즌 · 옛 저장) 빈 출연진 — 리그 열 팀 Xls 니블은 0 이라 맨몸 겹이 이미 받는다.
 */
export function castOfTeamRecordEquipment(teamId: number, equipment: TeamRecordEquipment | undefined): StageCast {
  if (equipment === undefined) return {}
  const roster = teamBatters(teamId)
  const equippedBatters = Object.entries(equipment.batters ?? {}).flatMap(([slot, nibbles]) => {
    const player = roster[Number(slot)]
    if (player === undefined) return []
    const [hit = 0, power = 0, , run = 0] = nibbles
    return [{ bodyType: bodyTypeOf(player.profile >> 4), equipment: batterEquipmentOf({ hit, power, run }) }]
  })
  const pitcherEquipments = Object.values(equipment.pitchers ?? {}).map((nibbles) => pitcherEquipmentOfNibbles(nibbles))
  return { equippedBatters, pitcherEquipments }
}

function mergedCast(...casts: readonly StageCast[]): StageCast {
  return {
    aceBatters: casts.flatMap((cast) => cast.aceBatters ?? []),
    acePitchers: casts.flatMap((cast) => cast.acePitchers ?? []),
    equippedBatters: casts.flatMap((cast) => cast.equippedBatters ?? []),
    pitcherEquipments: casts.flatMap((cast) => cast.pitcherEquipments ?? []),
  }
}

/** 타석 선수 그림(타자 · 투수 · 루 주자) */
export function stageSpritePreloadsOf(...casts: readonly StageCast[]): SpriteFolderPreload[] {
  return stageCastSpritePreloadsOf(mergedCast(...casts))
}

/** 수비 화면 그림(야수 · 주자 · 공 · 실린 마선수 수비 그림) */
export function defensePreloadsOf(...casts: readonly StageCast[]): SpriteFolderPreload[] {
  const cast = mergedCast(...casts)
  return defenseSpritePreloadsOf({ batters: cast.aceBatters ?? [], pitchers: cast.acePitchers ?? [] })
}

/** 경기 하나의 선수 · 수비 그림 전부 */
export function gameSpritePreloadsOf(...casts: readonly StageCast[]): SpriteFolderPreload[] {
  return mergeSpritePreloads(stageSpritePreloadsOf(...casts), defensePreloadsOf(...casts))
}

/**
 * 경기 첫 그림 몫 — 두 몸통 폼의 대기 자세 · 투수 선 자세 · 루 주자 · 수비 바탕과 서 있기 · 달리기 칸.
 * 로딩 판이 없는 길(나리 투수편)도 경기 첫 판(DUE UP · 수비 위치 걷기)부터 이 그림을 쓰므로 앞 화면에서 바로 받는다.
 */
export function gameEntryCastPreloadsOf(): SpriteFolderPreload[] {
  return mergeSpritePreloads(stageEntrySpritePreloadsOf(), defenseEntrySpritePreloadsOf())
}
