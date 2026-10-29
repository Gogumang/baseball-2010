import {
  applyPitcherGameResult,
  applyPitcherLeagueDay,
  gainPitcherMorale,
  withPitcherGameLeagueRecords,
  withPitcherGameStaminas,
  type PitcherCareer,
} from '@/entities/pitcher-career/model/pitcherCareer'
import { nariMoraleAfterBurst, nariMoraleOf, withNariTeamRecordMorales } from '@/entities/career/model/nariMorale'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitcherGameOptions, PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { pitcherGameOutcomeOf } from '@/pages/pitcher-league/model/pitcherGameOptions'

/**
 * 두 팀 투수 레코드 +0x2c 는 경기 끝 값이 리그 표에 남는다 (준비 0x1c46c 가 g == 0 이면 열 팀 10000 으로 채운 뒤).
 * 동료·상대 CPU 투수 줄과 경기 끝 판정은 리그 기록표에 (정산 0xa8024 · 0xa7de8 — 정규시즌만, 내 투수 빼고)
 */
export function recordedLeagueCareerOf(
  played: PitcherCareer,
  summary: PitcherGameSummary,
  gameOptions: PitcherGameOptions,
  outcome: ReturnType<typeof pitcherGameOutcomeOf>,
): PitcherCareer {
  return withPitcherGameLeagueRecords(
    played,
    withPitcherGameStaminas(
      played,
      applyPitcherGameResult(played, outcome),
      gameOptions.ourTeamId,
      gameOptions.opponentTeamId,
      summary.pitcherStaminas,
    ),
    summary.leaguePitchers,
    // 간이 타석 · 도루 판의 도루 — 리그 타자 기록표 +0x2c (0xa56dc 모드 3 갈래, 정규시즌만)
    summary.leagueStolenBases,
    // 사람 경기 타석 — 리그 타자 기록표 +0x20~+0x2a (0xa8024 의 0xa56dc 모드 3 갈래, 정규시즌만)
    summary.leaguePlateAppearances,
    // 수비 그림 0x43278 이 올린 실책 — 리그 타자 기록표 +0x2e (게이트 없음)
    summary.leagueErrors,
  )
}

/**
 * CPU 경기 0xc2a48(4f296)는 평가 0xa719c(4f274)가 사기를 바꾼 **뒤**다 — 간이 엔진 0xb570c b5768 이 두 팀 레코드 +2 에 그 사기를
 * 쓴다. 평가는 정규시즌 경기만
 */
function moraleAtCpuGamesOf(played: PitcherCareer, recorded: PitcherCareer, summary: PitcherGameSummary): number {
  return played.postseason === null ? nariMoraleOf(gainPitcherMorale(recorded, summary.evaluation.moraleChange)) : nariMoraleOf(recorded)
}

/**
 * 같은 날 나머지 네 경기(CPU 경기 0xc2a48)와 하루 끝. 사람 경기 상대의 리그 레코드 +2 는 이 경기에서 0xb570c 가 그 칸을 마지막으로
 * 덮을 때의 나리 사기로 남는다 (`teamRecordMorales`, r101). 마지막 타석의 돌발 보상이 사기를 바꾸면 그 뒤로는 안 덮여 **바뀌기 전
 * 값**이다 (`PitcherGameSummary.opponentRecordMorale`, r104)
 */
export function rollLeagueDayOf(
  played: PitcherCareer,
  recorded: PitcherCareer,
  summary: PitcherGameSummary,
  gameOptions: PitcherGameOptions,
  random: RandomPort,
  aceLevels: Readonly<Record<number, number>> | undefined,
): PitcherCareer {
  return withNariTeamRecordMorales(
    applyPitcherLeagueDay(recorded, random, aceLevels, moraleAtCpuGamesOf(played, recorded, summary)),
    [gameOptions.opponentTeamId],
    summary.opponentRecordMorale ?? nariMoraleAfterBurst(gameOptions.teamMorale, summary.burstRewardDeltas ?? []),
  )
}
