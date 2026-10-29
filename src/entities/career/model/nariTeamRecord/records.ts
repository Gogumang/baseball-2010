import { LEAGUE_TEAM_COUNT, teamBatters } from '@/entities/career/model/nariTeamRecord/otherSlices'
import {
  MY_RECORD_SLOT,
  NO_RECORD_ACE,
  type NariTeamRecord,
  type NariTeamRecordFields,
  type NariTeamRecords,
} from '@/entities/career/model/nariTeamRecord/types'

/** 붙박이 표 그대로의 팀 레코드 — 등록 `0x204e1(저장, 편, 1)` 이 마스터 팀(`0x1f8c1`)을 깊은 복사(0x1fe5c)한 꼴 */
export function tableNariTeamRecord(teamId: number): NariTeamRecord {
  return {
    batters: teamBatters(teamId).map((player, slot) => ({ slot, position: player.position ?? 0 })),
    acePitcher: NO_RECORD_ACE,
  }
}

/**
 * 내 선수를 타자 배열에 넣는다 — `0xb53f0(팀, 내 선수, 1)` 의 0x80 갈래(b549e~b552c, 직접 떴다):
 * 배열을 하나 늘리고(0xb4e34) 칸 t(내 선수 +0xa & 0x1f)의 선수를 수비 위치 0 · 칸 번호 끝으로 **맨 끝에 옮긴 뒤**,
 * 칸 t 에 내 선수를 그 선수의 수비 위치로 앉힌다.
 */
export function insertMyBatter(record: NariTeamRecord, slot: number): NariTeamRecord {
  const batters = [...record.batters]
  const seated = batters[slot]
  if (seated === undefined) return { ...record, batters: [...batters, { slot: MY_RECORD_SLOT, position: 0 }] }
  batters.push({ ...seated, position: 0 })
  batters[slot] = { slot: MY_RECORD_SLOT, position: seated.position }
  return { ...record, batters }
}

/**
 * 열 팀 레코드를 새로 — 등록 104 확정 0x10fb4: `0x204e1(저장, 4|3, 1)` 로 열 팀을 마스터에서 다시 짓고, 타자편이면
 * 내 팀에 `0xb53f1(내 팀, 내 선수, 1)` (투수편 내 투수는 위 머리말 미해결).
 */
export function createNariTeamRecords(myTeamId: number, myBatterSlot: number | null): NariTeamRecords {
  return Array.from({ length: LEAGUE_TEAM_COUNT }, (_unused, team) => {
    const table = tableNariTeamRecord(team)
    return team === myTeamId && myBatterSlot !== null ? insertMyBatter(table, myBatterSlot) : table
  })
}

/**
 * 커리어의 열 팀 레코드. 저장에 없으면 등록 때의 꼴로 세운다 — 타자편은 `battingOrder − 1` 칸에 내 선수를 넣고 그 칸의
 * 선수를 맨 끝으로(`insertMyBatter`), 투수편(`battingOrder` 없음)은 붙박이 그대로다.
 *
 * 옛 저장(레코드가 없던 웹)의 타순은 타순 이벤트(보상 19 → `0xb5d09`)만 바꿔 왔고, 0xb5d09 는 "내 선수를 새 칸에, 그 칸의 선수를
 * 맨 끝에, 떠난 칸의 원래 주인을 그 자리로" 돌리므로 마선수가 없는 동안은 늘 이 꼴과 같다.
 */
export function nariTeamsOf(fields: NariTeamRecordFields & { readonly battingOrder?: number }): NariTeamRecords {
  if (fields.nariTeams !== undefined && fields.nariTeams.length === LEAGUE_TEAM_COUNT) return fields.nariTeams
  return createNariTeamRecords(fields.teamId, fields.battingOrder === undefined ? null : fields.battingOrder - 1)
}

/** 레코드에서 한 팀 — 팀 번호가 리그 밖(국가대항전 팀 10~)이면 붙박이 표 */
export function nariTeamRecordOf(records: NariTeamRecords, teamId: number): NariTeamRecord {
  return records[teamId] ?? tableNariTeamRecord(teamId)
}

/** 한 팀을 바꿔 끼운다 */
export function withNariTeamRecord(records: NariTeamRecords, teamId: number, record: NariTeamRecord): NariTeamRecords {
  if (teamId < 0 || teamId >= LEAGUE_TEAM_COUNT) return records
  return records.map((current, team) => (team === teamId ? record : current))
}
