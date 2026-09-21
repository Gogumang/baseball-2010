import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { countsAsAtBat, isHit } from '@/entities/at-bat/model/atBatOutcome'
import { BATTERS_PER_TEAM, PITCHERS_PER_TEAM } from '@/entities/team/model/teamRoster'

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
 * **투수 줄도 같은 표에 쌓는다** (투수편이 들어와 여기에 칸을 늘렸다). 원본은 같은 선수 레코드의
 * 다른 오프셋에 투수 성적을 쌓는다 (P1-pitcher-rules.md 6절 — 아웃 +0x20 · 실점 +0x22 ·
 * 세이브 +0x24 · 탈삼진 +0x26 · 투구 수 +0x28 · 승 +0x2e · 패 +0x2f). 웹은 로스터가 타자 12명 ·
 * 투수 8명으로 따로 있어 표도 두 칸으로 나눈다.
 *
 * ⚠️ **내 육성 선수는 이 표에 넣지 않는다.** 내 성적은 `career.stats` 가 이미 세고 있어서,
 * 여기에도 넣으면 두 번 세게 된다. 순위표를 만들 때 `seasonAwards.myLeagueRecordOf`(타자) ·
 * `pitcherSeasonFlow.myPitcherLeagueRecordOf`(투수) 로 끼워 넣는다.
 *
 * ⚠️ **아직 빈 곳**: 타자 줄은 사람 경기도 채우지만(`gameFlow.leaguePlateAppearances`),
 * **사람 경기의 상대 팀 선발 투수 줄은 아직 안 온다** — `features/play-game`·`play-team-game`·
 * `play-pitcher-game` 의 요약에 투수 등판 칸이 없다. 그래서 내 팀과 붙은 날의 상대 선발만
 * 그 하루치 등판을 못 받는다(45경기 중 팀마다 ~5경기). 원본은 사람 경기도 같은 0xa8024·0xa7de8 을
 * 부르므로 요약에 칸이 생기면 `recordLeaguePitcherAppearances` 로 그대로 이으면 된다.
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
 * 투수 한 명의 시즌 줄 — 원본 선수 레코드(0x30 바이트)의 투수 칸 그대로다
 * (P1-pitcher-rules.md 6절, 시즌 시작 0xb6cc4 가 모두 0 으로 되돌린다).
 */
export interface LeaguePitcherLine {
  /** +0x20 잡은 아웃 수 (÷3 = 이닝). **0 이하면 순위표에서 뺀다** */
  readonly outs: number
  /** +0x22 실점 — 원본도 자책/비자책을 가르지 않는다. 방어율 분자다 */
  readonly runsAllowed: number
  /**
   * +0x24 세이브.
   *
   * ⚠️ **웹은 늘 0 이다.** 원본은 경기 끝 0xa7de8 이 `state+0x5c/0x60`(세이브 측·투수)을 보고
   * 매기는데, 웹 간이 엔진은 **구원 교체가 아예 없어** 선발 하나가 끝까지 던진다 — 세이브 상황이
   * 생길 수가 없다. 지어내지 않고 0 으로 둔다 (그래서 마무리 보직의 세이브왕은 아직 못 준다).
   */
  readonly saves: number
  /** +0x26 탈삼진 */
  readonly strikeouts: number
  /** +0x28 투구 수 (원본은 0~9999 에서 자른다) */
  readonly pitches: number
  /** +0x2e 승 */
  readonly wins: number
  /** +0x2f 패 */
  readonly losses: number
}

export const EMPTY_LEAGUE_PITCHER_LINE: LeaguePitcherLine = {
  outs: 0,
  runsAllowed: 0,
  saves: 0,
  strikeouts: 0,
  pitches: 0,
  wins: 0,
  losses: 0,
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
  /**
   * 투수 전역 번호 → 그 투수의 이번 시즌 성적.
   *
   * ⚠️ **옛 저장에는 이 칸이 없다**(타자 네 칸만 쌓던 때의 저장). 그래서 읽는 쪽
   * (`leaguePitcherLineOf`·`recordLeaguePitcherAppearances`)이 `undefined` 를 견디게 해 두었다 —
   * 저장 형식 번호는 올리지 않는다(올리면 `load` 가 옛 저장을 통째로 버린다).
   */
  readonly pitchers?: Readonly<Record<number, LeaguePitcherLine>>
}

/**
 * ⚠️ 빈 표에는 `pitchers` 칸을 **두지 않는다** — 투수 줄이 생기기 전 저장과 **같은 모양**이라야
 * 옛 저장을 그대로 읽을 수 있다 (`shared/api/save/localStorageSaveGame.ts` 의 `normalizeCareer` 가
 * 타자편 저장을 `{ batters }` 로만 다시 짓는다). 읽는 쪽이 `undefined` 를 견딘다.
 */
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

/**
 * 투수 전역 번호 — `teamRoster.teamPitchers` 가 `PITCHERS.slice(팀 × 8, +8)` 로 자르는 칸 그대로다.
 * 선발 칸(0~3)은 `pitcherRotation.rotationSlotOf` 가 날짜로 정한다.
 */
export function leaguePitcherIdOf(teamId: number, pitcherSlot: number): number {
  const slot = ((pitcherSlot % PITCHERS_PER_TEAM) + PITCHERS_PER_TEAM) % PITCHERS_PER_TEAM
  return teamId * PITCHERS_PER_TEAM + slot
}

/** 그 투수의 이번 시즌 성적. 한 번도 안 던졌으면(또는 옛 저장이면) 0 줄이다 */
export function leaguePitcherLineOf(stats: LeaguePlayerStats, pitcherId: number): LeaguePitcherLine {
  return stats.pitchers?.[pitcherId] ?? EMPTY_LEAGUE_PITCHER_LINE
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
  return { ...stats, batters }
}

/**
 * 등판 하나 — 어느 팀 투수 칸이 몇 아웃을 잡고 무엇을 내줬는가.
 * `simulateHalfInning` 의 `HalfInningResult` 가 반 이닝마다 내놓는 값을 그대로 모은 것이다.
 */
export interface LeaguePitcherAppearance {
  readonly teamId: number
  /** 로스터 투수 칸 (선발이면 `rotationSlotOf(day)`) */
  readonly pitcherSlot: number
  /** +0x20 잡은 아웃 수 */
  readonly outs: number
  /** +0x22 실점 */
  readonly runsAllowed: number
  /** +0x26 탈삼진 */
  readonly strikeouts: number
  /** +0x28 투구 수 */
  readonly pitches: number
  /**
   * 승패 투수 판정 (0xa7de8 이 `state+0x44/0x48`·`+0x50/0x54` 로 찾는 자리).
   * 없으면 `null` — 웹 안전망으로 무승부가 났을 때뿐이다.
   */
  readonly decision: '승' | '패' | null
}

/** 원본 투구 수 칸은 u16 을 0~9999 에서 자른다 (P1 3-1 · 6절) */
const MAXIMUM_PITCH_COUNT = 9999

function addPitcherAppearance(
  line: LeaguePitcherLine,
  appearance: LeaguePitcherAppearance,
): LeaguePitcherLine {
  return {
    outs: line.outs + appearance.outs,
    runsAllowed: line.runsAllowed + appearance.runsAllowed,
    // ⚠️ 세이브는 웹에 구원 교체가 없어 늘 0 이다 (`LeaguePitcherLine.saves` 주석)
    saves: line.saves,
    strikeouts: line.strikeouts + appearance.strikeouts,
    pitches: Math.min(MAXIMUM_PITCH_COUNT, line.pitches + appearance.pitches),
    wins: line.wins + (appearance.decision === '승' ? 1 : 0),
    losses: line.losses + (appearance.decision === '패' ? 1 : 0),
  }
}

/**
 * 등판 여러 개를 한 번에 쌓는다 — 타자 쪽 `recordLeaguePlateAppearances` 와 짝이다.
 * 원본은 투구·아웃마다 레코드를 건드리지만(0xa5e14·0xa8cca) 결과는 같다.
 */
export function recordLeaguePitcherAppearances(
  stats: LeaguePlayerStats,
  appearances: readonly LeaguePitcherAppearance[],
): LeaguePlayerStats {
  if (appearances.length === 0) return stats

  const pitchers: Record<number, LeaguePitcherLine> = { ...stats.pitchers }
  for (const appearance of appearances) {
    const id = leaguePitcherIdOf(appearance.teamId, appearance.pitcherSlot)
    pitchers[id] = addPitcherAppearance(pitchers[id] ?? EMPTY_LEAGUE_PITCHER_LINE, appearance)
  }
  return { ...stats, pitchers }
}
