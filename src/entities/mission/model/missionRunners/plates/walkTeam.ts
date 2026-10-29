import { MISSION_ACE_ROSTER_SLOT, missionRecordNibbleRowOf } from '@/entities/mission/model/missionCpuTeam'
import { MISSION_NARI_RECORD } from '@/entities/mission/model/missionGame'
import { defenseTeamOf, offenseOf, rowAtRecord } from '@/entities/mission/model/missionRunners/offense'
import { rosterSlotAt, teamBatters } from '@/entities/mission/model/missionRunners/otherSlices'
import { QUICK_LINEUP_SLOTS, type MissionOffense, type MissionPlateSituation } from '@/entities/mission/model/missionRunners/types'

/** 운동장 전경 · 벤치 클리어링의 한 줄 팀 재료 — 지금 투수 마투수 번호(0x79b48 a)와 레코드 타자 배열 차례(자리 니블 · 마타자 번호) */
export interface MissionWalkTeam {
  readonly pitcherAce: number | null
  readonly records: readonly { readonly position: number; readonly ace: number | null }[]
}

type WalkRecord = MissionWalkTeam['records'][number]

/** 레코드 +0x1c 의 자리 니블 (아래 4비트) */
const POSITION_NIBBLE_MASK = 0xf

/** 레코드 차례마다 자리 니블 · 마타자 번호 (CPU 팀만 마타자가 선다) */
function walkRecordsOf(team: MissionOffense, isCpuTeam: boolean, aceNumber: number): WalkRecord[] {
  const roster = teamBatters(team.teamId)
  const nibbleOfRow = (row: number | null) =>
    row === null || row === MISSION_ACE_ROSTER_SLOT || row === MISSION_NARI_RECORD ? 0 : (roster[row]?.position ?? 0) & POSITION_NIBBLE_MASK
  const nibbleOfRecord = (record: number) => nibbleOfRow(missionRecordNibbleRowOf(team.records, record))
  const inLineup = new Map<number, number>()
  for (let order = 0; order < QUICK_LINEUP_SLOTS; order += 1) inLineup.set(rosterSlotAt(team.lineup, order), order)
  const recordCount = Math.max(team.records.length, ...[...inLineup.keys()].map((record) => record + 1))
  const hasAce = isCpuTeam && aceNumber >= 0
  return Array.from({ length: recordCount }, (_unused, record) => ({
    position: nibbleOfRecord(inLineup.get(record) ?? record),
    ace: hasAce && rowAtRecord(team, record) === MISSION_ACE_ROSTER_SLOT ? aceNumber : null,
  }))
}

/** 지금 투수 마투수 — CPU 팀 마운드가 마투수 칸일 때(타자 미션) */
function cpuMoundAceOf(run: MissionPlateSituation, isCpuTeam: boolean, aceNumber: number): number | null {
  const pitching = isCpuTeam ? run.cpu.pitching : null
  if (pitching === null || aceNumber < 0) return null
  const moundRow = pitching.roster[pitching.mound.pitcherSlot] ?? pitching.mound.pitcherSlot
  return moundRow === MISSION_ACE_ROSTER_SLOT ? aceNumber : null
}

/**
 * **미션 경기 한 줄 팀의 레코드 차례** (`0xb8a34(팀, k)` — 0x3fac4 · 0xb0fb4 · 0x3a5f0 이 훑는 그 배열). 공격 팀은 `offenseOf`(투수 미션 =
 * CPU 타선, 타자 미션 = 사람 칸), 수비 팀은 `missionDefenseFieldersOf` 와 같은 고름(타자 미션 = CPU `cpuAutoBatting`, 투수 미션 = 사람 칸).
 * 레코드 k 의 자리 니블:
 * - 타순 칸 s 에 선 레코드 = 레코드 s 줄의 니블 — 대타 0xaebe4 가 시작 칸 니블을 들어온 레코드에 넘긴다(`missionDefenseFieldersOf` 머리말).
 *   마타자는 0xb53f0 의 0x40 갈래가 XlsACE_BAT 행 0x30 바이트를 통째 베껴 +0x1c 가 0(다섯 행 모두 행 바이트 28 = 0)이고, 0xaae7c 의
 *   `0xb8cb8(팀, team+0x32, 9)` → 0xb5e98(r3 = 0)은 한쪽 자리가 0 이면 자리를 칸에 되쓰므로(b5f10~b5f4a) 마타자가 선 칸은
 *   **옛 그 칸 선수의 니블**이다(`missionRecordNibbleRowOf`).
 * - 타순 밖 레코드 = 그 레코드 칸의 니블(붙박이 벤치는 0, 마타자에게 밀려 9번으로 간 붙박이는 **0** — 같은 되쓰기).
 * 마타자 번호 = 미션 마선수 순번 − 1 (`missionRunnerAcesOf` 와 같다). 지금 투수 마투수 = CPU 팀 마운드가 마투수 칸일 때(타자 미션).
 * ⚠️ 근사(남김 — 결과 같음): 미션 타자 레코드(`MISSION_NARI_RECORD`)의 니블을 웹은 0 으로 둔다. 원본(r276 다시 뜸): 0xb53f0 의 0x80 갈래가
 * 레코드 k 에 옛 [k] 줄 니블을 남기고(b54b6 · b5520), 이어 aa7e8 0xb8cb8(팀, 시작 타순 s, k) → 0xb5e98(r3 = 0)이 두 줄을 맞바꾼다 —
 * 두 니블이 다 0 이 아니면 니블이 선수를 따라가고(b5f32~b5f4a), 한쪽이 0 이면 칸에 되쓴다(b5f1a~b5f30). 그래서 미션 타자의 니블은 k ≤ 8 이면
 * 마스터 줄 k 의 것, k ≥ 9(벤치 · 끝 칸 12)면 마스터 줄 s 의 것이고, 그때 k 칸으로 밀린 마스터 줄 s 는 0 이다. 사람 칸 팀은 타자 미션에서
 * 공격만 하므로 이 니블을 읽는 수비 줄 이름표에 서지 않아 그림 · 결과가 같다.
 */
export function missionWalkTeamOf(run: MissionPlateSituation, isDefense: boolean): MissionWalkTeam | null {
  const team = isDefense ? defenseTeamOf(run) : offenseOf(run)
  if (team === null) return null
  const isCpuTeam = run.mission.side === '타자' ? isDefense : !isDefense
  const aceNumber = run.mission.opponentAce - 1
  const records = walkRecordsOf(team, isCpuTeam, aceNumber)
  return { pitcherAce: cpuMoundAceOf(run, isCpuTeam, aceNumber), records }
}
