import { MISSION_ACE_ROSTER_SLOT } from '@/entities/mission/model/missionCpuTeam'
import { MISSION_NARI_RECORD } from '@/entities/mission/model/missionGame'
import type { RosterPlayer } from '@/shared/config/original/roster'
import { defenseTeamOf, rowAtRecord } from '@/entities/mission/model/missionRunners/offense'
import { rosterSlotAt, teamBatters } from '@/entities/mission/model/missionRunners/otherSlices'
import { FIELDER_COUNT, QUICK_LINEUP_SLOTS, type MissionDefenseSituation, type MissionOffense } from '@/entities/mission/model/missionRunners/types'

type Roster = ReturnType<typeof teamBatters>

/** 판 시작이 한 칸에 앉힌 야수 — 미션 타자 · 마타자 표지 레코드면 `player` 가 없다 */
interface MissionFielder {
  readonly slot: number
  readonly positionCode: number
  readonly player: RosterPlayer | undefined
}

/** 레코드 +0x1c 의 자리 니블 (아래 4비트) */
const POSITION_NIBBLE_MASK = 0xf
/** 자리 니블 1 = 지명타자 */
const DESIGNATED_HITTER_POSITION = 1

function positionOfRow(roster: Roster, row: number): number {
  return (roster[row]?.position ?? 0) & POSITION_NIBBLE_MASK
}

function playerOfRow(roster: Roster, row: number): RosterPlayer | undefined {
  return row === MISSION_NARI_RECORD || row === MISSION_ACE_ROSTER_SLOT ? undefined : roster[row]
}

/** 레코드 → 자리 니블 — 타순 칸 s 에 선 레코드는 시작 때 칸 s 레코드(= 레코드 s)의 자리, 나머지는 0 */
function positionsByRecordOf(defense: MissionOffense, roster: Roster): Map<number, number> {
  const positions = new Map<number, number>()
  for (let order = 0; order < QUICK_LINEUP_SLOTS; order += 1) {
    positions.set(rosterSlotAt(defense.lineup, order), positionOfRow(roster, rowAtRecord(defense, order)))
  }
  return positions
}

/** 레코드 차례로 자리 니블 − 1 칸에 첫 레코드(겹치면 앞 레코드) — `filled` 를 채워 가며 */
function seatedFieldersOf(defense: MissionOffense, roster: Roster, filled: boolean[]): MissionFielder[] {
  const positions = positionsByRecordOf(defense, roster)
  const fielders: MissionFielder[] = []
  for (let record = 0; record < defense.records.length; record += 1) {
    const positionCode = positions.get(record) ?? 0
    const slot = positionCode - 1
    const isOpenSlot = slot >= 0 && slot < FIELDER_COUNT && !filled[slot]
    if (!isOpenSlot) continue
    filled[slot] = true
    fielders.push({ slot, positionCode, player: playerOfRow(roster, rowAtRecord(defense, record)) })
  }
  return fielders
}

/**
 * 판 시작 0xb0fb4 가 칸 1~8 에 앉히는 **야수 레코드** — 레코드 차례로 자리 니블 − 1 칸에 첫 레코드(겹치면 앞 레코드).
 * 미션 타자 · 마타자 표지면 `player` 가 없다(수비 팀에는 안 생긴다). 자리 니블은 `missionDefenseAbilitiesOf` 머리말대로 대타가 맞바꾼 값.
 *
 * 칸 0 은 판 시작이 안 찾지만 공수 교대 판 0x3fac4 는 니블 1(지명타자)을 칸 0 의 +0xec 에 넣는다 — 능력치(펌블 · 레이저)만 본다.
 * 그 판이 적은 레코드(`fielderZeroRecord`)를 알면 그것이다(그 뒤 대타로 지명 자리가 옮겨도 +0xec 는 그대로)
 */
export function missionDefenseFieldersOf(run: MissionDefenseSituation, withDesignated = false): MissionFielder[] {
  const defense = defenseTeamOf(run)
  if (defense === null) return []
  const roster = teamBatters(defense.teamId)
  const seatedZero = withDesignated ? run.fielderZeroRecord : null
  const isZeroFilled = !withDesignated || seatedZero !== undefined
  const filled = Array.from({ length: FIELDER_COUNT }, (_unused, slot) => slot === 0 && isZeroFilled)
  const zero: MissionFielder[] =
    seatedZero == null ? [] : [{ slot: 0, positionCode: DESIGNATED_HITTER_POSITION, player: playerOfRow(roster, rowAtRecord(defense, seatedZero)) }]
  return [...zero, ...seatedFieldersOf(defense, roster, filled)]
}

/**
 * 미션 시작 첫 0x18 판의 0x3fac4 3fe0a~3fe4c 가 칸 0 의 +0xec 에 적는 레코드 — 수비 팀 레코드 차례에서 그때 자리 니블이 1(지명)인
 * 첫 레코드(`missionDefenseFieldersOf` 와 같은 니블 셈). 없으면 null(안 덮어 장면 직후 값 0 이 남는다)
 */
export function missionBoardFielderZeroOf(run: MissionDefenseSituation): number | null {
  const defense = defenseTeamOf(run)
  if (defense === null) return null
  const roster = teamBatters(defense.teamId)
  for (let order = 0; order < QUICK_LINEUP_SLOTS; order += 1) {
    if (positionOfRow(roster, rowAtRecord(defense, order)) === DESIGNATED_HITTER_POSITION) return rosterSlotAt(defense.lineup, order)
  }
  return null
}
