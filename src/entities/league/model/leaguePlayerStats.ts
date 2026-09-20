import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { countsAsAtBat, isHit } from '@/entities/at-bat/model/atBatOutcome'
import { BATTERS_PER_TEAM } from '@/entities/team/model/teamRoster'

/**
 * 리그 선수 시즌 기록표 — 타석 기록 함수 (binary.mod 0xa8024).
 *
 * 원본은 사람 경기(0xae24c·0xae3e8)와 CPU 끼리 경기(0xc2a48 → 0xc1054·0xc1170·0xc15a4·0xc1818)가
 * **같은 0xa8024** 를 불러 선수 레코드마다 타수(+0x20)·안타(+0x22)·홈런(+0x28)·타점(+0x2a)을 쌓는다.
 * 그래서 45경기가 끝나면 리그 선수 전원에게 시즌 성적이 있고, 개인 타이틀 순위표 0x9d789 가
 * 그 레코드들을 훑어 1위를 뽑는다 (B-season-awards.md B-2, **확정**).
 *
 * 웹판 로스터(`shared/config/original/roster.ts`)는 이름·능력치 네 칸뿐인 **붙박이 표**라 성적을
 * 담을 칸이 없다. 그래서 성적만 따로 떼어 이 표에 담고, 선수는 **타자 전역 번호**로 가리킨다
 * (`팀 × 12 + 로스터 칸` = `BATTERS` 배열의 색인 그대로).
 *
 * ⚠️ **투수 칸(승·패·세이브·탈삼진·자책점)은 쌓지 않는다** (추정이 아니라 의도적인 빈칸이다).
 * 원본은 같은 레코드에 투수 성적도 쌓지만, 웹 간이 엔진은 선발 하나가 9이닝을 던지고 교체·세이브·
 * 자책점 개념이 아예 없어 넣을 값이 없다. 지어내지 않고 **타자 네 칸만 원본대로** 쌓는다 —
 * 웹의 육성 선수는 타자뿐이라(원본 모드 4) 타이틀·MVP·연봉 등급이 보는 칸이 정확히 이 넷이다.
 * (투수편이 들어오면 여기에 칸을 늘리면 된다.)
 *
 * ⚠️ **내 육성 선수는 이 표에 넣지 않는다.** 내 성적은 `career.stats` 가 이미 세고 있어서,
 * 여기에도 넣으면 두 번 세게 된다. 순위표를 만들 때 `seasonAwards.myLeagueRecordOf` 로 끼워 넣는다.
 */
export interface LeagueBatterLine {
  /** +0x20 타수 */
  readonly atBats: number
  /** +0x22 안타 */
  readonly hits: number
  /** +0x28 홈런 */
  readonly homeRuns: number
  /** +0x2a 타점 */
  readonly runsBattedIn: number
}

export const EMPTY_LEAGUE_BATTER_LINE: LeagueBatterLine = {
  atBats: 0,
  hits: 0,
  homeRuns: 0,
  runsBattedIn: 0,
}

/**
 * 시즌 단위로 사는 표. 새 시즌에 통째로 비운다 —
 * 원본 `0x204e0(저장, 편, 0)` 이 리그 전 선수의 시즌 성적을 0 으로 되돌린다
 * (`playerCareer.startNextSeason` 참고).
 *
 * 한 번도 타석에 서지 않은 선수는 칸이 아예 없다. 저장 용량을 아끼려는 것이 아니라,
 * 순위표가 어차피 **타수 ≤ 0 인 선수를 빼기** 때문이다 (0x9d789 의 첫 제외 조건).
 */
export interface LeaguePlayerStats {
  /** 타자 전역 번호 → 그 선수의 이번 시즌 성적 */
  readonly batters: Readonly<Record<number, LeagueBatterLine>>
}

export const EMPTY_LEAGUE_PLAYER_STATS: LeaguePlayerStats = { batters: {} }

/** 타석 하나 — 어느 팀 타순 몇 번이 무엇을 쳤고 몇 점을 냈는가 */
export interface LeaguePlateAppearance {
  readonly teamId: number
  /** 간이 엔진이 쓰는 타순 커서. 12 명을 돌려 쓰므로 나머지로 로스터 칸을 정한다 */
  readonly battingOrderIndex: number
  readonly outcome: AtBatOutcome
  readonly runsBattedIn: number
}

/**
 * 타자 전역 번호 — `teamRoster.batterAt` 가 `roster[타순 % 12]` 로 고르는 것과 같은 칸이다.
 * 음수 타순이 들어올 일은 없지만, 나머지 연산이 음수를 내지 않도록 한 번 더 감싼다.
 */
export function leagueBatterIdOf(teamId: number, battingOrderIndex: number): number {
  const slot = ((battingOrderIndex % BATTERS_PER_TEAM) + BATTERS_PER_TEAM) % BATTERS_PER_TEAM
  return teamId * BATTERS_PER_TEAM + slot
}

/** 그 선수의 이번 시즌 성적. 타석에 선 적이 없으면 0 줄이다 */
export function leagueBatterLineOf(stats: LeaguePlayerStats, batterId: number): LeagueBatterLine {
  return stats.batters[batterId] ?? EMPTY_LEAGUE_BATTER_LINE
}

/** 타석 하나를 한 줄에 더한다 (0xa8024 의 네 칸). 타수는 볼넷을 빼고 센다 */
function addPlateAppearance(
  line: LeagueBatterLine,
  outcome: AtBatOutcome,
  runsBattedIn: number,
): LeagueBatterLine {
  return {
    atBats: line.atBats + (countsAsAtBat(outcome) ? 1 : 0),
    hits: line.hits + (isHit(outcome) ? 1 : 0),
    homeRuns: line.homeRuns + (outcome.kind === '홈런' ? 1 : 0),
    runsBattedIn: line.runsBattedIn + runsBattedIn,
  }
}

/**
 * 타석 여러 개를 한 번에 쌓는다. 경기 하나(또는 하루치 다섯 경기)를 마친 뒤 한 번 부르면 된다 —
 * 원본은 타석마다 부르지만 결과는 같고, 불변 객체를 타석마다 새로 만들지 않아도 된다.
 */
export function recordLeaguePlateAppearances(
  stats: LeaguePlayerStats,
  plateAppearances: readonly LeaguePlateAppearance[],
): LeaguePlayerStats {
  if (plateAppearances.length === 0) return stats

  const batters: Record<number, LeagueBatterLine> = { ...stats.batters }
  for (const appearance of plateAppearances) {
    const id = leagueBatterIdOf(appearance.teamId, appearance.battingOrderIndex)
    batters[id] = addPlateAppearance(
      batters[id] ?? EMPTY_LEAGUE_BATTER_LINE,
      appearance.outcome,
      appearance.runsBattedIn,
    )
  }
  return { batters }
}
