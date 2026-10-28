import { defenseAbilitiesOf, defenseSkillIdsOf, defenseFielderPlatesOf } from '@/features/defense-play/model/runDefensePlay'
import { entryBatterGameAbilities, NO_ROSTER_SLOT, NO_ACE_BATTER } from '@/features/play-team-game/model/teamGameRoster'
import { fielderRecordsAtPlayStart } from '@/entities/fielding/model/fielderRecords'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import { runnersOfGame } from '@/entities/game/model/gameState'
import { runnerOnBase } from '@/entities/game/model/baseRunners'
import { abilityContextOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import { entryBatterSkillIdsOf, entryBattersOf } from '@/features/play-team-game/model/teamGameFlow/roster/batters'
import { BATTING_ORDER_SIZE } from '@/features/play-team-game/model/teamGameFlow/types/constants'
import type { TeamFielderSeat } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 한 팀의 수비 아홉 칸 능력치 — 타순에 선 선수의 **경기용** 수비(질병·보직·사기·팀 능력치·코치까지
 * 먹인 값, J-4)를 로스터의 수비 자리 코드로 칸에 꽂는다.
 * 칸 0(투수)은 판 시작 0xb0fb4 가 선수를 찾지 않아(b1032) 진행기가 고정값으로 둔다 — 마운드 투수를 넣지 않는다.
 */
export function defenseAbilitiesFor(progress: TeamGameProgress, teamId: number): readonly (number | null)[] {
  const context = abilityContextOf(progress.options)
  const abilities: (number | null)[] = defenseAbilitiesOf(
    entryBattersOf(progress, teamId).map((player, slot) => ({
      position: player.position,
      defense: entryBatterGameAbilities(context, teamId, player, slot)[2],
    })),
  )
  // 칸 0 은 +0xec(마지막 교대 판의 지명타자 — 상대 팀일 수 있다). b41ec 가 팀 레코드는 **지금 수비 팀**으로 넘기므로(0xb8681(팀[st[0xa]]))
  // 팀 능력치 · 시즌 보정은 수비 팀 것으로 센다. 그 레코드는 니블 1(지명)이라 보직 불일치(0xb5844)가 없어 명단 칸을 안 넘긴다. 비었으면 null
  const seat = fielderRecordsFor(progress, teamId)[0]
  abilities[0] = seat == null ? null : entryBatterGameAbilities(context, teamId, seat.player, NO_LINEUP_SLOT)[2]
  return abilities
}

/** 보직 불일치 판정에 넘길 명단 칸이 없음 — `entryBatterGameAbilities` 의 `context.lineup[칸]` 이 비어 벌점이 없다 */
const NO_LINEUP_SLOT = -1

/**
 * `teamId` 명단 차례 칸 `index` 의 +0xec 자리 — 실책 열쇠는 도루와 같다(표 밖 선수는 원본 id, 마타자는 웹 기록표에 칸이 없어 null).
 */
export function teamFielderSeatOf(progress: TeamGameProgress, teamId: number, index: number): TeamFielderSeat {
  const player = entryBattersOf(progress, teamId)[index]!
  const errorKey =
    player.aceIndex >= 0
      ? null
      : player.rosterSlot === NO_ROSTER_SLOT
        ? player.recordId === undefined
          ? null
          : { teamId, battingOrderIndex: NO_ROSTER_SLOT, recordId: player.recordId }
        : { teamId: player.tableTeamId ?? teamId, battingOrderIndex: player.rosterSlot }
  return { teamId, index, errorKey, player }
}

/**
 * 판 시작 0xb0fb4 뒤의 야수 +0xec 아홉 칸 — 칸 1..8 은 그 판 수비 팀(`teamId`) 명단으로 다시 훑고 칸 0 은 진행기가 든 값
 * (`fielderRecords` — 마지막 교대 판 0x3fac4 가 적은 것, `entities/fielding/model/fielderRecords`).
 */
export function fielderRecordsFor(progress: TeamGameProgress, teamId: number): readonly (TeamFielderSeat | null)[] {
  return fielderRecordsAtPlayStart(progress.fielderRecords, entryBattersOf(progress, teamId), (index) => teamFielderSeatOf(progress, teamId, index))
}

/**
 * 한 팀의 수비 아홉 칸 스킬 번호 — `defenseAbilitiesFor` 와 같은 칸 고르기. 레이저 0x66a8c · 필살수비가 야수 +0xec 레코드에
 * `0xb62b4(선수, 0x15)`(초감각)를 묻는다 — 명단 줄 레코드 +0x14(`entryBatterSkillIdsOf`, 마타자는 제 행) (`defenseSkillIdsOf`)
 */
export function fielderSkillIdsFor(progress: TeamGameProgress, teamId: number): (readonly number[])[] {
  const skills = defenseSkillIdsOf(
    entryBattersOf(progress, teamId).map((player) => ({ position: player.position, skillIds: entryBatterSkillIdsOf(player) })),
  )
  // 칸 0 — 66ad4 0xb62b4(+0xec, 0x15) 도 +0xec 레코드에 묻는다
  const seat = fielderRecordsFor(progress, teamId)[0]
  skills[0] = seat == null ? [] : entryBatterSkillIdsOf(seat.player)
  return skills
}

/**
 * 수비 아홉 칸의 **이름 판 선수** (0x43cb0 — `defenseFielderPlatesOf`) — 칸 고르기는 `defenseAbilitiesFor` 와 같다.
 * 칸 0 은 지금 마운드 투수(보직 = 레코드 +0xb & 3). 마투수 · 보직 없는 투수는 보직을 안 넘긴다(→ 판 없음, 타자편 `gameFlow` 와 같다).
 */
export function fielderPlatesFor(progress: TeamGameProgress, teamId: number, pitcherIndex: number) {
  const pitchers = teamId === progress.options.ourTeamId ? progress.ourPitcherEntry : progress.opponentPitcherEntry
  const pitcher = pitchers[pitcherIndex]
  return defenseFielderPlatesOf(
    entryBattersOf(progress, teamId),
    pitcher === undefined
      ? undefined
      : pitcher.aceIndex >= 0 || pitcher.role === undefined
        ? { name: pitcher.name }
        : { name: pitcher.name, role: pitcher.role },
  )
}

/**
 * 공격 팀 타자 · 루 위 주자의 **마선수 번호** (`runnerAces` — 주자 그림 0x79d10 · 적재 0x483a0). 명단 칸의 마타자(`aceIndex` 0~4)만.
 * `ours` 면 우리 공격(타순 = 경기 타순), 아니면 상대 공격(상대 타순).
 */
export function runnerAcesFor(progress: TeamGameProgress, ours: boolean): RunnerAces {
  const entry = ours ? progress.ourEntry : progress.opponentEntry
  const order = ours ? progress.game.battingOrderIndex : progress.opponentOrderIndex
  const runners = runnersOfGame(progress.game, order)
  const aceOf = (slot: number | null) => {
    if (slot === null) return null
    const ace = entry[slot]?.aceIndex ?? NO_ACE_BATTER
    return ace >= 0 ? ace : null
  }
  return {
    batter: aceOf(((order % BATTING_ORDER_SIZE) + BATTING_ORDER_SIZE) % BATTING_ORDER_SIZE),
    first: aceOf(runnerOnBase(runners, 1)),
    second: aceOf(runnerOnBase(runners, 2)),
    third: aceOf(runnerOnBase(runners, 3)),
  }
}
