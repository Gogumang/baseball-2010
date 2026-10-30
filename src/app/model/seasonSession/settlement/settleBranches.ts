import type { RandomPort } from '@/shared/api/random/randomPort'
import type { TeamGameOptions, TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import { setLiveGameInningIndex, setLiveGameSides, liveGameSidesOf } from '@/shared/lib/liveGameState/liveGameState'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { applySeasonBurstRewards } from '@/entities/season-mode/model/seasonRewards'
import { seasonHumanWonOf, evaluateSeasonGame, applySeasonGameEvaluation } from '@/entities/season-mode/model/seasonEvaluation'
import { advancePostseason, recordLeagueResult } from '@/entities/league/model/league'
import { EMPTY_LEAGUE_PLAYER_STATS, recordLeagueStolenBases, recordLeaguePlateAppearances } from '@/entities/league/model/leaguePlayerStats'
import { SEASON_SCENE_STATE, type SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'
import { playLeagueDay } from '@/entities/league/model/leagueDay'
import { postseasonDayOf } from '@/app/model/seasonSession/awards/seasonAwards'
import { NO_CHAMPION } from '@/app/model/seasonSession/constants/seasonConstants'
import { seasonAbilityContextOf } from '@/app/model/seasonSession/game/pitcherOrder'
import {
  humanGameRecordAcesOf,
  recordSeasonHumanGamePitchers,
  recordUngatedSeasonRecords,
  seasonRecordAcesAfterGame,
} from '@/app/model/seasonSession/records/humanGameRecords'
import { cpuLeagueRecordOf } from '@/app/model/seasonSession/roster/roster'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'
import { withDayEndRecovery, withGameEndStamina } from '@/app/model/seasonSession/stamina/stamina'
import { cupSettledSaveOf, regularSeasonSettledSaveOf } from '@/app/model/seasonSession/settlement/settledSaves'

/**
 * 전역 경기 상태 +0x6b 에 이 경기 끝 이닝이 남는다(0xb6b6c — 정규·포스트시즌·국가대항전 모두) (`liveGameState`).
 * 측별 팀 +0x28(0x6548 의 0xb6bd4) · 점수 +0x7e 도 남는다 — 0xd9 상세의 스킬 14 갈래(0xb5a28~)가 본다
 */
export function recordLiveGameEnd(summary: TeamGameSummary, gameOptions: TeamGameOptions | null): void {
  setLiveGameInningIndex(summary.inningsPlayed - 1)
  const playerSide = summary.playerSide ?? gameOptions?.playerSide
  if (playerSide !== undefined) setLiveGameSides(liveGameSidesOf(summary, { ...summary, playerSide }))
}

/**
 * 0x4f3d6 — 같은 진입이 +0x4c+모드(+0x4e)를 0 으로 쓰고 저장한다(정산과 한 커밋). 돌발미션 보상·페널티(0x8e34c 모드 2)는
 * 판정이 난 경기 중에 SR·팀 사기에 바로 더하므로 평가보다 앞이다 — 요약이 `resolveBurst` 의 deltas 를 판정 차례대로 싣고 온다.
 * 국가대항전 중 사기(종류 1)는 리그 칸이 아니라 상대국 슬롯 +0x934 에 쌓인다(원본 버그 — `applySeasonBurstRewards`)
 */
export function savedAfterBurstOf(latest: SeasonSave, summary: TeamGameSummary, isNationalCup: boolean): SeasonSave {
  const savedBefore: SeasonSave = { ...latest, isGameInProgress: false, gameSave: null }
  const afterBurst = applySeasonBurstRewards(savedBefore.state, summary.burstRewardDeltas ?? [], isNationalCup)
  return afterBurst === savedBefore.state ? savedBefore : { ...savedBefore, state: afterBurst }
}

/**
 * 승패는 원본 셈 `0xb69c8`·`0x4f072` 로 다시 낸다 — 이긴 칸 = R(1) > R(0) ? 1 : 0 이라 **동점이면 선공(칸 0) 쪽이 이긴다**.
 * 요약의 `won`(내 점수 > 상대 점수)은 동점을 패로 본다. 원본 시즌 경기는 동점으로 끝나지 않는다(경기 끝 판정 0xb68fc 가 동점이면
 * 끝을 안 낸다 — E 3d · `seasonHumanWonOf` 주석). 웹 경기도 연장 상한이 없어(`gameState`) 같다 — 비교식만 원본 모양 그대로 둔다.
 * 사람 칸은 이 경기 옵션의 `playerSide` 다 (`state[0x31 + 칸] == 0`)
 */
export function humanWonOf(summary: TeamGameSummary, gameOptions: TeamGameOptions | null): boolean {
  return gameOptions === null ? summary.won : seasonHumanWonOf(summary.ourScore, summary.opponentScore, gameOptions.playerSide)
}

/** 평가를 안 받는 갈래(포스트시즌 · 국가대항전)가 커밋할 저장과 다음 장면 */
export interface UnevaluatedSettlement {
  readonly save: SeasonSave
  readonly next: SeasonSceneState
}

/**
 * 포스트시즌 — 4f268 → 4f29a 0xb818c(포스트시즌 갈래는 스태미나를 안 건드린다) → 4f2bc 열 팀 +20%.
 * CPU 끼리 경기 0xc2760 은 여기서 돌지 않는다 — 부르는 곳은 결산 0xef 키 0x9dc8(9eba) 하나뿐이라 정산 → 장면 0x105
 * 새로 세우기(팁 rand(0, 73)) → 0xef 진입 → 사람이 키를 눌렀을 때다(`continuePostseason`). 그때 회복이 **끝난** 이 표로
 * 서고 깎인 값이 그대로 남는다(0xc2760 의 하루 끝 0xb818c 포스트시즌 갈래는 회복이 없고, 0xb617c 는 0x4ea0c 에서만 불린다)
 */
export function postseasonSettlementOf(
  current: SeasonSave,
  summary: TeamGameSummary,
  won: boolean,
  played: SeasonRecord,
  gameOptions: TeamGameOptions | null,
  ownRotationShift: number,
): UnevaluatedSettlement | null {
  const series = current.series ?? null
  if (series === null) return null
  const { record } = current.state
  const winner = won ? record.teamId : summary.opponentTeamId
  const rested = withDayEndRecovery(withGameEndStamina(current, summary, ownRotationShift))
  const advanced = advancePostseason(series, winner)
  const save: SeasonSave = {
    ...rested,
    // 포스트시즌도 0xdd 진입이 두 팀 시즌 레코드에 마선수를 넣는다(L+0x34 를 안 본다 — 66ae 는 S+0x12c 만) (U-105 r154)
    recordAces: seasonRecordAcesAfterGame(rested.recordAces, humanGameRecordAcesOf(gameOptions, summary, record.teamId)),
    // 사사구 +0x2a(정산 꼬리 a8b04~a8bee) · 실책 +0x2e(그림 0x43278)는 게이트 0xa56dc 밖이라 포스트시즌에도 쌓인다
    playerStats: recordUngatedSeasonRecords(current.playerStats ?? EMPTY_LEAGUE_PLAYER_STATS, summary),
    series: advanced,
    state: {
      ...current.state,
      record: { ...played, games: postseasonDayOf(advanced), postseasonChampion: advanced.champion ?? NO_CHAMPION },
    },
  }
  return { save, next: SEASON_SCENE_STATE.시즌결산 }
}

/**
 * 국가대항전 — 내 쪽은 시즌 팀(SR[1], 0~9)이 아니라 **경기에 들어간 대한민국(10)** 이다. 0x6548 국가대항전 가지(65e2 `cmp r5,#0xa`)가
 * 경기[0x28+side] 에 10 을 꽂았고, 결과 장면 0x4ea0c 는 그 경기 팀으로 0xb76dc/0xb77e0 을 부른다. 같은 날 CPU 경기 두 나라는 사람
 * 경기가 깎아 둔 상대국 슬롯 레코드(base+0x934)의 투수 +0x2c 에서 선다 (701a7a9) — 요약의 상대 투수 끝 스태미나가 그 값이다.
 * 굴림 `advanceNationalCupDay` 는 `cupSettledSaveOf` 안에서 같은 자리에 돈다
 */
export function rollCupSettlement(
  current: SeasonSave,
  summary: TeamGameSummary,
  won: boolean,
  played: SeasonRecord,
  random: RandomPort,
): UnevaluatedSettlement | null {
  const cup = current.cup ?? null
  if (cup === null) return null
  const opponent = summary.opponentTeamId
  const winner = won ? summary.ourTeamId : opponent
  const loser = won ? opponent : summary.ourTeamId
  const save = cupSettledSaveOf(current, cup, winner, loser, random, summary, opponent, summary.burstRewardDeltas ?? [], played)
  return { save, next: SEASON_SCENE_STATE.국가대항전 }
}

/** 정규시즌 리그 기록표 — 양 팀 타석 · 도루 +0x2c · 투수 줄(0xa8024 · 0xa7de8) · 게이트 밖 두 칸 */
function regularSeasonPlayerStatsOf(current: SeasonSave, summary: TeamGameSummary) {
  const plateAppearances = recordLeaguePlateAppearances(current.playerStats ?? EMPTY_LEAGUE_PLAYER_STATS, summary.leaguePlateAppearances)
  const stolenBases = recordLeagueStolenBases(plateAppearances, summary.leagueStolenBases ?? [])
  return recordUngatedSeasonRecords(recordSeasonHumanGamePitchers(stolenBases, summary.leaguePitchers), summary)
}

/**
 * 정규시즌 — 내 경기 전적 → 끝 스태미나 되적기 → 같은 날 CPU 경기 0xc2a48(굴림, 깎기) → 하루 끝 4f2bc 열 팀 +20% → 평가 0xa719c.
 * 원본 차례는 내 경기 전적 → 평가 → 나머지 네 경기 → 하루 끝이지만, 평가는 리그를 읽지 않아 하루를 먼저 돌려도 값이 같다.
 */
export function rollRegularSeasonSettlement(
  current: SeasonSave,
  summary: TeamGameSummary,
  won: boolean,
  played: SeasonRecord,
  gameOptions: TeamGameOptions | null,
  ownRotationShift: number,
  random: RandomPort,
  aceLevels: Readonly<Record<number, number>> | undefined,
) {
  const { record } = current.state
  const opponent = summary.opponentTeamId
  const afterMyGame = won ? recordLeagueResult(current.league, record.teamId, opponent) : recordLeagueResult(current.league, opponent, record.teamId)
  const afterGameStamina = withGameEndStamina(current, summary, ownRotationShift)
  const day = playLeagueDay(
    afterMyGame,
    record.games,
    record.teamId,
    random,
    regularSeasonPlayerStatsOf(current, summary),
    afterGameStamina.cpuPitcherStaminas,
    aceLevels,
    // 사람 경기 두 팀의 로테이션 한 칸(0x6548 670e~673e)은 여기서 리그 차례에 넣는다 — 선발은 `optionsFor` 가 미리 셈했다
    true,
    seasonAbilityContextOf(current.state),
    // 트레이드로 바뀐 CPU 팀은 시즌 저장의 레코드로 선다 (0xc239c → 0xb8680 → 0x1f570)
    (team) => cpuLeagueRecordOf(current, team),
  )
  const rested = withDayEndRecovery({ ...afterGameStamina, cpuPitcherStaminas: day.pitcherStaminas })
  // 평가가 꽂은 16칸(played.gameRecord)을 읽는다
  const evaluation = evaluateSeasonGame(played, {
    myRuns: summary.ourScore,
    opponentRuns: summary.opponentScore,
    won,
    tied: summary.ourScore === summary.opponentScore,
    // 완투 두 칸 — 인기도와 평판이 서로 다른 이닝 칸을 본다
    popularityCompleteGame: summary.popularityCompleteGame,
    reputationCompleteGame: summary.reputationCompleteGame,
    opponentTeamId: opponent,
  })
  const evaluated = applySeasonGameEvaluation({ ...current.state, record: played }, evaluation)
  return { save: regularSeasonSettledSaveOf(rested, day, gameOptions, summary, record, evaluated), evaluation }
}
