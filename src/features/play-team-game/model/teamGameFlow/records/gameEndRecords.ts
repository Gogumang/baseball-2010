import { isBugFixed } from '@/shared/config/bugfixes'
import { ourHalfOf } from '@/entities/game/model/gameState'
import { gameEndRecordIdsOf, completeGameRecordIdsOf } from '@/entities/game/model/gameRecords'
import { type MySide, recordSeasonGameEvent } from '@/entities/season-mode/model/seasonReputation'
import { TEAM_GAME_MODE } from '@/features/play-team-game/model/gameAbilities'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **경기 끝 기록** — `0xa7de8`(0x4ea0c 가 부른다): 37~39 점수차 승 · 28~31 완투 계열. 둘 다 0xa77f0 의 방향 게이트는
 * 건너뛰지만 자동진행 게이트(a77f2)는 지난다.
 *
 * 이긴 팀은 `0xb69c8`: 팀 1 점수(state[0x7f]) > 팀 0 점수면 팀 1, **아니면(동점 포함) 팀 0** 을 보고 그 팀의
 * `state[0x31+팀] == 0`(사람)인지 본다 — 팀 0 = 선공(측 0). 그래서 비긴 경기는 우리가 선공일 때 "이긴 경기" 다
 * (원본 그대로 — 점수차 0 이라 37~39 는 안 나오지만 완투 계열은 나올 수 있다).
 * 완투 계열은 그 밖에 모드 ≠ 4 · `state[0x8c]`(사람이 코스를 확정한 적 있음) · 우리 **현재** 투수 R[3] == 3 × 치른 이닝.
 * 피안타·출루·실점은 팀 단위 칸 state[0x89]·[0x88]·[0x8a] 다 (`pitching`).
 */
export function gameEndRecordIdsFor(progress: TeamGameProgress): readonly number[] {
  // 0x4ea0c 는 경기가 끝나야 부른다 — 도중의 요약에는 안 붙인다
  if (!progress.game.isFinished) return []
  const game = progress.game
  const won = isHumanTeamWinOf(game)
  if (!won) return []
  return [
    ...gameEndRecordIdsOf(game.ourScore - game.opponentScore),
    ...completeGameRecordIdsOf({
      mode: progress.options.mode,
      won,
      pitchCourseConfirmed: progress.recordTally.pitchCourseConfirmed,
      // state[0x6b] + 1 — 치른 이닝 전부 (연장이면 그만큼)
      inningsPlayed: game.inning,
      outsRecorded: progress.recordTally.moundOuts,
      hitsAllowed: progress.pitching.hitsAllowed,
      // state[0x88] — 볼넷 수가 아니라 정산이 세운 출루 허용 표시다 (`allowedBaserunner`)
      baserunnerAllowed: progress.pitching.allowedBaserunner,
      runsAllowed: progress.pitching.runsAllowed,
    }),
  ]
}

/**
 * 이긴 팀 `0xb69c8` 이 사람 팀인가 — 팀 1 점수 > 팀 0 점수면 팀 1, 아니면(동점 포함) 팀 0(선공).
 * 고침(B-40): 동점은 이긴 경기가 아니다 (원본은 선공이면 이긴 경기 — `seasonHumanWonOf`)
 */
function isHumanTeamWinOf(game: TeamGameProgress['game']): boolean {
  if (game.ourScore !== game.opponentScore) return game.ourScore > game.opponentScore
  return !isBugFixed('B-40') && ourHalfOf(game) === '초'
}

/* ── 시즌 평판 16칸 (0xa8024 → 0xa755c → 0xa3440) ─────────────────────────────── */

/**
 * 게이트 `0xa755c` 를 통과시켜 코드 몇 개를 한꺼번에 올린다.
 *
 * 원본 게이트는 (1) **모드 2(시즌)** 이고 (2) 시즌 레코드가 있고 (3) 코드 ≤ 5 면 공격측이,
 * ≥ 6 이면 수비측이 **CPU** 일 때만 적는다. (2)는 부르는 쪽(시즌 세션)이 보장하고,
 * (3)은 `recordSeasonGameEvent` 가 `mySide` 로 가른다 — 여기서는 (1)만 본다.
 */
export function withSeasonRecord(progress: TeamGameProgress, mySide: MySide, codes: readonly number[]): readonly number[] {
  if (progress.options.mode !== TEAM_GAME_MODE.시즌) return progress.gameRecord
  return codes.reduce((slots, code) => recordSeasonGameEvent(slots, code, mySide), progress.gameRecord)
}
