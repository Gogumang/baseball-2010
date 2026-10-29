import { MISSION_ACE_ROSTER_SLOT } from '@/entities/mission/model/missionCpuTeam'
import { missionDefenseFieldersOf } from '@/entities/mission/model/missionRunners/defense/fielders'
import { missionBatterSlotOf, offenseOf, rowAtRecord } from '@/entities/mission/model/missionRunners/offense'
import {
  defenseFielderPlatesOf,
  missionOpponentOf,
  rosterSlotAt,
  runnerOnBase,
  teamPitchers,
  type RunnerAces,
} from '@/entities/mission/model/missionRunners/otherSlices'
import { missionRunnersOf } from '@/entities/mission/model/missionRunners/runners/identity'
import type { MissionPlateSituation } from '@/entities/mission/model/missionRunners/types'

/** 보직 = 레코드 +0xb & 3 (`profile & 3`) */
const ROLE_MASK = 3

/**
 * **수비 아홉 칸의 이름 판 선수** (0x43cb0 — `defenseFielderPlatesOf`). 칸 1~8 은 판 시작 0xb0fb4 가 앉힌 야수 레코드(`missionDefenseFieldersOf`,
 * 이름 0xb62c0 · 자리 +0x1c & 0xf 0x54590). 칸 0 은 0x43cb0 이 야수 +0xec 를 안 보고 `0xae83c(팀[st[0xa]])` = 수비 팀 팀[0] 투수(43e48~43e60)
 * 를 다시 찾고 보직은 `0xb6dec`(43e6a) 다:
 * - 타자 미션(모드 6) — CPU 팀 지금 마운드(`cpu.pitching.mound`). 마스터 줄이면 이름 + 보직(+0xb & 3 = `profile & 3`, 0xaa8a0 맞바꿈은
 *   줄째라 보직이 따라간다), 마투수 칸이면 이름만(보직 없음 → 판 없음, 타자편 `gameFlow` · 팀 경기와 같다).
 * - 투수 미션(모드 5) — 사람 칸 팀 0번 투수 = 미션 투수: aa826 `0xb8820` 이 0x1fbd0 기록을 투수 명부에 베끼고 aa81c~aa878 이
 *   0xb6389 · 0xb6349(육성 · 명예) 줄을 찾아 0xb5e98 로 0번에 앉힌다. 미션은 투수가 안 바뀐다.
 */
export function missionFielderPlatesOf(run: MissionPlateSituation): ReturnType<typeof defenseFielderPlatesOf> {
  const lineup = missionDefenseFieldersOf(run)
    .filter((fielder) => fielder.player !== undefined)
    .map((fielder) => ({ name: fielder.player?.name ?? '', position: fielder.positionCode }))
  return defenseFielderPlatesOf(lineup, missionMoundPitcherOf(run))
}

/** CPU 팀 마투수 칸이면 그 마선수 이름만(보직 없음) */
function missionAceMoundOf(run: MissionPlateSituation): { readonly name: string } | undefined {
  const ace = missionOpponentOf('투수', run.mission.opponentAce)
  return ace === null ? undefined : { name: ace.name }
}

function missionMoundPitcherOf(run: MissionPlateSituation): { readonly name: string; readonly role?: number } | undefined {
  if (run.mission.side === '투수') return run.missionPitcher
  const pitching = run.cpu.pitching
  if (pitching === null) return undefined
  const row = pitching.roster[pitching.mound.pitcherSlot] ?? pitching.mound.pitcherSlot
  if (row === MISSION_ACE_ROSTER_SLOT) return missionAceMoundOf(run)
  const pitcher = teamPitchers(pitching.teamId)[row]
  return pitcher === undefined ? undefined : { name: pitcher.name, role: pitcher.profile & ROLE_MASK }
}

/**
 * **공격 팀 타자 · 루 위 주자의 마선수 번호** (`runnerAces` — 주자 그림 0x79d10 · 적재 0x483a0). 주자 +0x9c 는 0xa94ca 가 적는
 * 0xb63a0 마선수 번호라 마선수 레코드만 선다 — 미션에서는 투수 미션 CPU 타선의 마타자 칸(0xaae7c 가 레코드 9 에 베낀 마선수,
 * 번호 = 0xb63a1 = 순번 − 1)뿐이다. 타자 미션의 사람 칸 팀은 마스터 줄 · 미션 타자(육성 · 명예, 0x40 비트 아님)라 늘 null 이다.
 */
export function missionRunnerAcesOf(run: MissionPlateSituation): RunnerAces {
  const offense = offenseOf(run)
  const aceNumber = run.mission.opponentAce - 1
  const aceOf = (slot: number | null): number | null => {
    if (slot === null || offense === null || aceNumber < 0) return null
    return rowAtRecord(offense, rosterSlotAt(offense.lineup, slot)) === MISSION_ACE_ROSTER_SLOT ? aceNumber : null
  }
  const runners = missionRunnersOf(run)
  return {
    batter: aceOf(missionBatterSlotOf(run)),
    first: aceOf(runnerOnBase(runners, 1)),
    second: aceOf(runnerOnBase(runners, 2)),
    third: aceOf(runnerOnBase(runners, 3)),
  }
}
