import {
  recordLeagueErrors,
  recordLeagueFreePasses,
  recordLeaguePlateAppearances,
  recordLeagueStolenBases,
} from '@/entities/league/model/leaguePlayerStats'
import type { LeagueFieldingError, LeaguePlateAppearance, LeagueStolenBase } from '@/entities/league/model/leaguePlayerStats'
import type { GameLeaguePitchers } from '@/entities/game/model/gamePitcherLines'
import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
import { recordHumanGamePitchers, staminaTableAfterHumanGame } from '@/entities/pitcher-career/model/leaguePitcherRecords'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer/types/pitcherCareer'

/**
 * 사람 경기의 CPU 투수 줄(내 투수 빼고)과 경기 끝 판정을 리그 기록표에 쌓는다 — 정규시즌 경기만 (`recordHumanGamePitchers`).
 * `before` 는 경기 **전** 커리어다(포스트시즌인지 본다).
 */
export function withPitcherGameLeagueRecords(
  before: PitcherCareer,
  after: PitcherCareer,
  pitchers: GameLeaguePitchers | undefined,
  /**
   * 이 경기 도루(리그 타자 기록표 +0x2c 재료) — 모드 3 의 0xa56dc 갈래(0xa571c)는 포스트시즌(+0xb4)이면 거짓이라 정규시즌만 쌓는다
   * (국가대항전 경기는 이 길을 안 탄다)
   */
  stolenBases: readonly LeagueStolenBase[] = [],
  /**
   * 이 경기 타석(리그 타자 기록표 +0x20~+0x2a 재료) — 정산 0xa8024 의 타자 게이트 0xa56dc(모드 3 갈래 0xa571c)도 포스트시즌이면
   * 거짓이라 정규시즌만 쌓는다
   */
  plateAppearances: readonly LeaguePlateAppearance[] = [],
  /**
   * 이 경기 수비 그림이 올린 실책(리그 타자 기록표 +0x2e 재료 — 그리기 0x43278 4381a~43904). 게이트가 없어 포스트시즌에도 쌓는다
   */
  errors: readonly LeagueFieldingError[] = [],
): PitcherCareer {
  const regularSeason = before.postseason === null
  const withPitchers = recordHumanGamePitchers(after.leaguePlayerStats, pitchers, regularSeason)
  const gated = regularSeason ? recordLeagueStolenBases(recordLeaguePlateAppearances(withPitchers, plateAppearances), stolenBases) : withPitchers
  // 사사구 +0x2a(a8b04~a8bee) · 실책 +0x2e(0x43278)는 0xa56dc 게이트 밖이다. 사람 투구 판정이 볼넷을 세는 투수는 내 투수뿐이라
  // CPU 줄에는 `walks` 가 없다(내 투수는 커리어가 센다) — 그래도 같은 길로 둔다
  const leaguePlayerStats = recordLeagueErrors(recordLeagueFreePasses(gated, pitchers?.lines ?? []), errors)
  return leaguePlayerStats === after.leaguePlayerStats ? after : { ...after, leaguePlayerStats }
}

/**
 * 사람 경기 끝 두 팀 투수 레코드 +0x2c 를 리그 표에 되적는다 — `before` 는 경기 **전** 커리어(g 를 본다), `after` 는
 * `applyPitcherGameResult` 를 지난 커리어다.
 */
export function withPitcherGameStaminas(
  before: PitcherCareer,
  after: PitcherCareer,
  ourTeamId: number,
  opponentTeamId: number,
  /** 경기 끝 표 (`PitcherGameSummary.pitcherStaminas`). 없으면(진행기를 안 거친 요약) 표를 그대로 둔다 */
  staminas: { readonly ours: readonly number[]; readonly opponent: readonly number[] } | undefined,
): PitcherCareer {
  if (staminas === undefined) return after
  return {
    ...after,
    leaguePitcherStaminas: staminaTableAfterHumanGame(before, leagueDayCounterOf(before), [
      { teamId: ourTeamId, staminas: staminas.ours },
      { teamId: opponentTeamId, staminas: staminas.opponent },
    ]),
  }
}
