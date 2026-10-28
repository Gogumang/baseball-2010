import type { QuickAtBatBatter } from '@/entities/game/model/quickAtBat'
import { ACE_BATTER_ROSTER_SLOT, aceBatterPlayerOf, gameAceBatterOf } from '@/features/play-game/model/gameAces'
import { aceLevelOf, aceLevelSlotOf, aceRecordAbilityAtLevel } from '@/entities/mission/model/aceLevel'
import { batterAt, teamBatters } from '@/entities/team/model/teamRoster'
import { recordAbilityOf } from '@/entities/team/model/recordAbility'
import type { RosterPlayer } from '@/shared/config/original/roster'
import { rosterSlotAt, withLineupRecordSlot } from '@/entities/game/model/quickLineup'
import { BATTER_SLOT, gameAbilityOf } from '@/features/play-team-game/model/gameAbilities'
import { PITCHER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import { teamAcesOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherOrder'
import type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/optionsTypes'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/**
 * 상대 타순 칸의 타자 능력치 (히트·파워·수비·주루 — 레코드 순서 그대로).
 *
 * 네 칸 모두 밑값은 레코드의 **`0xb6414(rec, k, 1)`** 이다 (`recordAbilityOf` — 장비 니블 → 장착 스킬 5 무력감 −100 ·
 * 7 전설 +50 · 타자 스킬 20 수비 −100, b6494~b6512). 경기용 능력치 0xb570c/0xb570d 가 첫머리 b5728 에서 플래그 1 로 부르고,
 * 모드 3 에서는:
 * ```
 * b5728  v = 0xb6415(타자, k, 1)          ; 마선수 배율 → 장비 → 스킬
 * b574a  모드 3·4: 0xb6389(타자) 거짓(내 육성 선수가 아니다) → b58e6
 * b58e6  체력 인자 90 → 감소 없음
 * b593a  팀 능력치 — 모드 마스크 0x306 = {1,2,8,9} 라 모드 3 은 없다
 *        코치 — 모드 2 만 · 0..999 로 자른다
 * ```
 * 그래서 `gameAbilityOf(모드 3, 내 팀 아님)` = 0xb6414 플래그 1 값을 0..999 로 자른 값이다.
 * - 히트: CPU 타자 결정 0x34334 가 `0xb570d(ctx, 0, 타자, 1, 90, 1)` 로 읽는다 (Q1 1b, ce462ce).
 * - 파워: 스윙 결과 0xab214 가 `0xb570d(팀, 1, 타자, 1, 0x5a, 1)` 로 읽는다 (ab4fe).
 * - 주루: 주자 속도 `0xb570c(팀, 3, 주자, …, 90)` (I-controls 3a).
 * - 수비: 이 타자가 수비에 서는 일은 사람 장면에 없다 — 같은 레코드 칸을 그대로 둔다.
 * 붙박이 줄의 스킬 비트 · 장비 니블은 Xls 행 그대로다(`RosterPlayer.skillBits` · `equipment`) — 간이 타석
 * (`teamRoster.quickBatterOf`)과 같은 밑값이다. 142 가 넣은 마타자는 레벨 배율(b6438) 뒤 같은 단계(`aceRecordAbilityAtLevel`).
 */
export function opponentBatterAbility(options: PitcherGameOptions, rosterSlot: number) {
  // 142 가 상대 명단 9번에 넣은 마타자가 CPU 대타로 서면 그 레코드 — 0xb6415 첫 단계가 레벨 배율을 먹인다
  const ace = rosterSlot === ACE_BATTER_ROSTER_SLOT ? aceBatterAbilityOf(options) : undefined
  const roster = teamBatters(options.opponentTeamId)
  const slot = rosterSlot % roster.length
  const record = ace ?? recordBatterAbilityOf(roster[slot], options.opponentEquipment?.batters?.[slot])
  const gameAbility = (base: number, slot: number) => gameAbilityOf({ mode: PITCHER_EDITION_MODE, base, isPitcher: false, slot, isMyTeam: false })
  return {
    hit: gameAbility(record.hit, BATTER_SLOT.히트),
    power: gameAbility(record.power, BATTER_SLOT.파워),
    defense: gameAbility(record.defense, BATTER_SLOT.수비),
    run: gameAbility(record.run, BATTER_SLOT.주루),
  }
}

/** 붙박이 줄 레코드의 `0xb6414(rec, k, 1)` 네 칸 (히트·파워·수비·주루) — `equipment` 는 레코드 장비 니블(없으면 Xls 행) */
function recordBatterAbilityOf(player: RosterPlayer, equipment?: readonly number[]) {
  const [hit, power, defense, run] = recordAbilityOf({ ...player, equipment: equipment ?? player.equipment }, false)
  return { hit, power, defense, run }
}

/**
 * **지금 상대 타자의 소개 판 재료** (상태 0xe 의 0x44944 — 타자 `0xae89c(공격 팀)`): 붙박이 표 칸이면 그 행의 이름·수비
 * `+0x1c & 0xf`·폼(`+0xb`, 손 0xb63c0 의 재료), 142 가 9번에 넣은 마타자면 이름과 마타자 순번. `rosterSlot` 은 리그 기록표 칸
 * (마타자면 null — 표에 칸이 없다).
 */
export function opponentBatterOf(progress: PitcherGameProgress): {
  readonly name?: string
  readonly position?: number
  readonly profile?: number
  /**
   * 레코드 장비 니블 네 칸(히트 · 파워 · 수비 · 주루) — 상대 팀 레코드 덮개(나리 새 시즌 0x665e8 이 굴린 값), 없으면 Xls 행.
   * 타석 교대 0x47cc8 이 마타자가 아니면 이 니블로 타자 그림 장비 겹(0x78fd8)을 싣는다(47e80~47eb6). 마타자는 없음
   */
  readonly equipment?: readonly number[]
  readonly aceIndex?: number
  readonly rosterSlot: number | null
} {
  const rosterSlot = rosterSlotAt(progress.opponentLineup, progress.opponentOrderIndex)
  if (rosterSlot === ACE_BATTER_ROSTER_SLOT) {
    const index = teamAcesOf(progress.options, false).batter
    const player = aceBatterPlayerOf(index)
    return { ...(player === undefined ? {} : { name: player.name, aceIndex: index }), rosterSlot: null }
  }
  const roster = teamBatters(progress.options.opponentTeamId)
  const player = roster[rosterSlot % roster.length]
  if (player === undefined) return { rosterSlot }
  const slot = rosterSlot % roster.length
  return {
    name: player.name,
    ...(player.position === undefined ? {} : { position: player.position }),
    profile: player.profile,
    equipment: progress.options.opponentEquipment?.batters?.[slot] ?? player.equipment,
    rosterSlot: slot,
  }
}

/** 상대 마타자 레코드의 `0xb6414(rec, k, 1)` 네 칸 — 레벨 배율(b6438) 뒤 장비 · 스킬 단계 (히트·파워·수비·주루) */
function aceBatterAbilityOf(options: PitcherGameOptions) {
  const index = teamAcesOf(options, false).batter
  const player = aceBatterPlayerOf(index)
  if (player === undefined) return undefined
  return aceRecordAbilityAtLevel(player, aceLevelOf(options.aces?.levels, aceLevelSlotOf('타자', index + 1)))
}

/** 간이 타석의 타자 — 명단 칸이 마타자 칸이면 142 가 넣은 마타자 */
export function quickBatterOfTeam(options: PitcherGameOptions, isOurs: boolean, rosterSlot: number): QuickAtBatBatter {
  if (rosterSlot === ACE_BATTER_ROSTER_SLOT) {
    const ace = gameAceBatterOf(teamAcesOf(options, isOurs).batter, options.aces?.levels)
    if (ace !== undefined) return ace
  }
  // 상대 줄은 레코드 장비 니블(나리 새 시즌 0x665e8)을 0xb6414 로 먹는다 — 내 팀은 굴리지 않는다
  return isOurs ? batterAt(options.ourTeamId, rosterSlot) : batterAt(options.opponentTeamId, rosterSlot, options.opponentEquipment)
}

/* ── 0xf 진입 · CPU 대타 ─────────────────────────────────────────────────────── */

/** 지금 상대 타순 칸에 선 선수의 로스터 칸 — CPU 대타가 들어오면 타순 칸과 갈린다 */
export function opponentRosterSlotOf(progress: PitcherGameProgress): number {
  return rosterSlotAt(progress.opponentLineup, progress.opponentOrderIndex)
}

/** 지금 상대 타자의 간이 타석 레코드 — 레코드 칸 0xb6394 는 명단이 든 첨자(`withLineupRecordSlot`), 마타자는 제 순번 */
export function opponentQuickBatterOf(progress: PitcherGameProgress): QuickAtBatBatter {
  const batter = quickBatterOfTeam(progress.options, false, opponentRosterSlotOf(progress))
  return withLineupRecordSlot(batter, progress.opponentLineup, progress.opponentOrderIndex)
}
