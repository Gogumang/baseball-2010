import { type DrawnFieldingError, fieldingErrorRecordsOf, fielderRecordIndexOf } from '@/features/defense-play/model/fieldingErrors'
import { teamBatters } from '@/entities/team/model/teamRoster'
import { teamRecordMoraleOf } from '@/entities/team/model/teamMorale'
import { passesRecordTeamGate } from '@/entities/game/model/gameRecords'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * 연속 파울 기록을 얹는다 — 공격 계열(32·33)이라 0xa77f0 게이트는 사람 공격(내 타석)에서 통과한다.
 */
export function withFoulRecords(progress: GameProgress, foulRecordIds: readonly number[] | undefined): GameProgress {
  const passed = gatedOffenseRecords(foulRecordIds ?? [])
  return passed.length === 0 ? progress : { ...progress, recordIds: [...progress.recordIds, ...passed] }
}

/**
 * 수비 아홉 칸의 이름 판 선수 — `opponentDefenseAbilitiesOf` 와 같은 칸 고르기다.
 * 칸 0 은 지금 마운드 투수(보직 = 레코드 +0xb & 3). 마선수 투수는 웹에 레코드 +0xb 가 없어 보직을 안 넘긴다 → 판 없음.
 */
/**
 * 수비 그림이 올린 실책(+0x2e, `features/defense-play/model/fieldingErrors`)을 리그 기록 재료에 얹는다 — 화면이 판 끝에 넘긴다.
 * 야수 +0xec 는 그림이 실은 레코드(판 입력 `fielderRecords` — `opponentFielderRecordsOf`)다: 칸 1..8 은 상대 명단에서 자리 니블이
 * 칸 + 1 인 첫 타자, 칸 0 은 1회초 판이 넣은 상대 지명타자이고 판이 안 섰으면 0 이라 안 쌓인다. 그림의 수비 팀이 상대가 아니면 버린다.
 */
export function recordDrawnFieldingErrors(progress: GameProgress, drawn: readonly DrawnFieldingError[]): GameProgress {
  const lineup = teamBatters(progress.opponentTeamId)
  const opponentDrawn = drawn.filter((error) => error.teamIndex === progress.opponentTeamId)
  const errors = fieldingErrorRecordsOf(opponentDrawn, (error) => {
    const index = fielderRecordIndexOf(lineup, error.slot)
    return index < 0 ? null : { teamId: progress.opponentTeamId, battingOrderIndex: index }
  })
  if (errors.length === 0) return progress
  return { ...progress, leagueErrors: [...(progress.leagueErrors ?? []), ...errors] }
}

/** 0xb570c(b5768)가 상대 팀 레코드 +2 를 지금 나리 사기로 덮었다 (`GameProgress.opponentRecordMorale`) */
export function withOpponentRecordTouched(progress: GameProgress): GameProgress {
  const morale = progress.teamMorale ?? teamRecordMoraleOf(progress.opponentTeamId)
  return progress.opponentRecordMorale === morale ? progress : { ...progress, opponentRecordMorale: morale }
}

/**
 * **경기 중 나리 사기가 바뀌었다** — 돌발 보상 0x8e34c 종류 1(8e410 0xa3a24 + 양 → 8e420 0xa3a44). 원본은 두 팀 레코드 +2 를 공마다
 * 0xb570c(b5768)로 다시 쓰므로 다음 공부터 두 팀 용량(0x66e44)이 새 값을 본다. 대회 중이면 부르는 쪽이 상대국 칸 값을 넘긴다
 */
export function withGameTeamMorale(progress: GameProgress, morale: number): GameProgress {
  return progress.teamMorale === morale ? progress : { ...progress, teamMorale: morale }
}

/** 사람 팀(우리)이 공격 중인 정산의 0xa77f0 게이트 — 타자편 사람 쪽 플레이는 늘 이 방향이다 */
export function gatedOffenseRecords(recordIds: readonly number[]): number[] {
  return recordIds.filter((id) => passesRecordTeamGate(id, { offenseIsHuman: true, defenseIsHuman: false }))
}
