import {
  insertMyBatter,
  myBatterIndexOf,
  tableNariTeamRecord,
} from '@/entities/career/model/nariTeamRecord'
import type { NariTeamRecord } from '@/entities/career/model/nariTeamRecord'
import { UNSHUFFLED_PITCHER_ORDER } from '@/entities/league/model/league'
import { advanceRotation } from '@/entities/pitcher-career/model/pitcherRotation'

/**
 * **나리 국가대항전 대회 레코드 두 칸** — 저장 블록 `[저장+0xbc]`(타자편)의 **+0xbc4 대표팀** · **+0xbe0 상대국** (시즌모드는 같은 꼴로
 * `[저장+0xb4]` 의 +0x918 · +0x934). 저장 크기 0x1fdf4 가 열 팀 뒤에 두 칸을 더해 저장에 들어간다. 직접 떴다:
 * ```
 * 0x1f8f8(저장, 팀)   모드 4 레코드: S+0x12c(국가대항전) ≠ 0 이면 팀 10 → +0xbc4, 그 밖 팀 → **모두 +0xbe0** · 아니면 +4 + 0x1c·팀
 * 0xb7bf0(L)          대회 초기화 — 0x205c1(g, 모드): +0xbc4 를 지우고 마스터 팀 10 을 깊은 복사(0x1fe5c) · 0xb6191 대한민국 투수 10000 ·
 *                     0x20649(g, 모드, 첫날 사람 경기 상대 0xb7614(L, 4, 1)): +0xbe0 에 마스터 그 팀을 복사
 * 상태 133 0x1a090    출전 갈래: 0xb7bf1 뒤 0xb53f1(대표팀, 0x1fc21(g) 내 선수, 1) — 0x80 갈래라 내 칸 t(+0xa, 나리 팀에서 다시 매긴
 *                     첨자 = 타순 − 1)의 선수를 위치 0 으로 맨 끝 벤치에, 칸 t 에 내 선수 (`insertMyBatter`) · 0x1faa1(g, 0, 1) · 저장
 * 142 진입 0x1c46c    같은 문(장면+0x288) 안 1c574: g = L+0x32(대회 날짜) ≠ 0 이면 상대 0xb8c80 · 모드 4 내 팀 0xb8c80 — 두 칸 다 0~3 을
 *                     제자리에서 한 칸 돌린다. 1c5fe: S+0x12c 면 마선수를 안 넣는다
 * 하루 끝 0xb818c     국가대항전 갈래 b81e0 대한민국 투수 10000 · b8216 0x20649 로 다음 날 상대를 +0xbe0 에 새로 복사
 * ```
 * 대표팀 칸은 대회 내내 이어지고(내 선수 · 투수 차례), 상대국 칸은 날마다 마스터에서 다시 선다. 경기는 0xb891c 가 이 두 칸으로 팀을
 * 세우고(타순 = 타자 배열 차례 · 선발 = 투수 0번), 143 엔트리 보기(0x1f9a9)도 이 두 칸을 보인다.
 */
export interface NariCupTeams {
  /** +0xbc4 대표팀(팀 10) — 내 선수가 낀 타자 배열 · 투수 차례(`pitchers`) */
  readonly korea: NariTeamRecord
  /** +0xbe0 상대국 — 그날 사람 경기 상대의 마스터 복사 */
  readonly opponent: NariTeamRecord
  /** 상대국 칸이 든 팀 번호 (11~13) */
  readonly opponentTeamId: number
}

/** 대표팀 팀 번호 */
const KOREA_TEAM = 10

/** 마스터 복사 — 붙박이 표 그대로 · 투수 차례 [0..7] */
function masterCupRecordOf(teamId: number): NariTeamRecord {
  return { ...tableNariTeamRecord(teamId), pitchers: UNSHUFFLED_PITCHER_ORDER }
}

/** 대회 초기화 0xb7bf0 + 상태 133 의 내 선수 넣기 — `myBatterSlot` 은 나리 팀에서의 내 칸(타순 − 1) */
export function createNariCupTeams(myBatterSlot: number, firstOpponentTeamId: number): NariCupTeams {
  return {
    korea: insertMyBatter(masterCupRecordOf(KOREA_TEAM), myBatterSlot),
    opponent: masterCupRecordOf(firstOpponentTeamId),
    opponentTeamId: firstOpponentTeamId,
  }
}

/** 142 진입(1c574) — 대회 날짜 g ≠ 0 이면 두 칸의 투수 0~3 을 한 칸씩 돌린다(영구) */
export function prepareNariCupMatch(teams: NariCupTeams, cupDay: number): NariCupTeams {
  if (cupDay === 0) return teams
  const rotate = (record: NariTeamRecord): NariTeamRecord => ({
    ...record,
    pitchers: advanceRotation(record.pitchers ?? UNSHUFFLED_PITCHER_ORDER),
  })
  return { ...teams, korea: rotate(teams.korea), opponent: rotate(teams.opponent) }
}

/** 하루 끝 b8216 — 다음 날 사람 경기 상대를 마스터에서 새로 복사. 대회가 끝나 상대가 없으면 그대로 */
export function nextNariCupDayTeams(teams: NariCupTeams, nextOpponentTeamId: number | null): NariCupTeams {
  if (nextOpponentTeamId === null) return teams
  return { ...teams, opponent: masterCupRecordOf(nextOpponentTeamId), opponentTeamId: nextOpponentTeamId }
}

/** 대회 칸의 팀 레코드 — 팀 10 은 대표팀 칸, 그 밖은 상대국 칸(0x1f8f8). 상대국 칸이 다른 팀이면 마스터 복사 */
export function nariCupRecordOf(teams: NariCupTeams, teamId: number): NariTeamRecord {
  if (teamId === KOREA_TEAM) return teams.korea
  return teams.opponentTeamId === teamId ? teams.opponent : masterCupRecordOf(teamId)
}

/** 대표팀 안 내 타순(첨자 + 1) — 없으면 null */
export function nariCupBattingOrderOf(teams: NariCupTeams): number | null {
  const index = myBatterIndexOf(teams.korea)
  return index < 0 ? null : index + 1
}
