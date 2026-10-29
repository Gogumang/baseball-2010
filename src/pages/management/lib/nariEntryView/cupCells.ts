import { teamRecordMoraleOf } from '@/entities/team/model/teamMorale'
import type { NariCupTeams } from '@/entities/career/model/nariCupTeams'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import { nariTeamRecordMoraleOf } from '@/entities/career/model/nariMorale'
import type { NariTeamRecordMoraleCareer } from '@/entities/career/model/nariMorale'
import type { NariEntryCellSource } from './types'

/** 대표팀 칸(+0xbc4)의 팀 번호 — 0x1f8f8 이 S+0x12c 동안 팀 10 을 그 칸으로 준다 */
const KOREA_CUP_TEAM = 10

/** 대회 칸 레코드 +2 — 상대국 칸은 대회 중 0xa3a24 가 읽고 쓰는 칸, 대표팀 칸은 그날의 나리 사기, 없으면 표값 */
function cupSlotMoraleOf(teamId: number, teams: NariCupTeams | undefined): number {
  if (teams !== undefined && teams.opponentTeamId === teamId) return teams.opponentMorale ?? teamRecordMoraleOf(teamId)
  if (teamId === KOREA_CUP_TEAM) return teams?.koreaMorale ?? teamRecordMoraleOf(teamId)
  return teamRecordMoraleOf(teamId)
}

/**
 * **국가대항전 143 의 기록 열 · 체력 줄 재료** (r216 직접 떴다). 목록 칸 그리기 0x56ebc 는 모드 갈래 없이 줄 레코드
 * `[팀+0x18/0x14][i] × 0x30 + 0x20` 을 읽고, 대회 중 0x1f9a9 → 0x1f8f8/0x1f940 이 대회 칸 두 개를 준다. 그 두 칸이 서는 곳:
 * ```
 * 0x205c0(g, 모드)    +0xbc4 를 0x1c 바이트 지우고(205fa~20610 memset) 0x1f8c0(g, 10) 마스터 팀 10 → 0x1fe5c(.., 0) 깊은 복사
 * 0x20648(g, 모드, t) +0xbe0 ← 0x1f8c0(g, t) 마스터 팀 t 를 0x1fe5c 로 복사 (대회 초기화 b7ca4 · 하루 끝 b8216 이 날마다 다시)
 * 0x1f8c0(g, t)       [g+0xac] + 0xac0 + 0x1c·t — 마스터 팀. 0x1ff98 이 Xls 행 0x30 바이트를 통째 베껴 싣는다(1ffe0~2004e)
 * 0x1fe5c             머리 0xc 바이트 + 타자 [+0x14] · 투수 [+0x18] 배열을 0x30 × 개수로 memcpy(0x1400418) — 레코드 칸 그대로
 * 0xb6190(팀)         투수 전원 +0x2c = 0x2710 — 대표팀은 대회 초기화 · 하루 끝 b81e0 이 부른다
 * ```
 * 시즌 시작 지우기 0xb6cc4(부르는 곳 0xc3e8 · 0x1b768 · 0x204e0 · 0xa3fec)는 나리 열 팀 복사본만 지우고 마스터는 안 건드리며,
 * 대회 경기의 정산 0xa8024 는 게이트 0xa56dc 가 S+0x12c(a5704~a571a `ldrb [S, #0x12c]`)에서 거짓이라 안 쌓는다.
 * 곧 143 의 붙박이 줄 +0x20~+0x2b 는 그 선수의 **Xls 행 기록 줄**(`RosterPlayer.recordLine` — 0 이 아니다, 예: 타자 1000타수)이고
 * 행 +0x2c~+0x2f 는 Xls 표 바이트가 타자 180행 모두 0(도루 · 실책 0) · 투수 120행 모두 `10 27 00 00`(+0x2c 10000 · 승 0 · 패 0)이다.
 * 마선수는 없다(142 1c5fe: S+0x12c 면 안 넣는다).
 * 팀 레코드 +2(체력 줄 용량 0x66e44): 상대국 칸은 `NariCupTeams.opponentMorale`(대회 중 0xa3a24 가 읽고 쓰는 칸), 대표팀 칸은
 * 처음엔 마스터 복사 표값이고 사람 경기 셋업 0x39fdc 3a31e · 공마다 0xb570c b5762 가 쓴 그날의 나리 사기가 남는다(`koreaMorale`).
 * 게이트 밖이라 대회 경기도 대표팀 칸에 쌓는 둘(r221 직접 떴다): 타자 +0x2e 실책(수비 그림 0x43278 4381a~43904 — 투수편 사람 수비,
 * `koreaErrors`) · 투수 +0x2a 사사구(정산 꼬리 a8b04~a8bee `0xae83d` 지금 마운드 투수 — 투수편 내 투수 사본, `myCupWalks`).
 * 붙박이 투수는 사람 판정(볼 넷)으로 공을 안 던지니(강판 뒤 0x21 간이) 사사구가 안 붙는다.
 */
export function nariCupEntryCellSourceOf(
  stats: LeaguePlayerStats,
  staminaMode: number,
  teamId: number,
  teams: NariCupTeams | undefined,
): NariEntryCellSource {
  const koreaErrors = teamId === KOREA_CUP_TEAM ? teams?.koreaErrors : undefined
  return {
    stats,
    staminas: undefined,
    staminaMode,
    morale: cupSlotMoraleOf(teamId, teams),
    isCupRecord: true,
    ...(koreaErrors !== undefined ? { cupErrors: koreaErrors } : {}),
  }
}

/**
 * 143 의 나리 리그 팀 레코드 +2 (`NariEntryCellSource.morale`). 내 팀 칸은 0xa3a24 가 읽는 칸 그 자체라 커리어 사기
 * (대회 중에도 리그 칸은 그대로 — 대회 동안 0xa3a24 는 상대국 칸을 읽는다, `nariMoraleOf`), 그 밖 팀은 `teamRecordMorales`.
 */
export function nariEntryTeamMoraleOf(career: NariTeamRecordMoraleCareer & { readonly morale: number }, isMyTeam: boolean, teamId: number): number {
  return isMyTeam ? career.morale : nariTeamRecordMoraleOf(career, teamId)
}
