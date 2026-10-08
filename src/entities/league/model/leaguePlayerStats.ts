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
 * **사람 경기의 투수 줄도 같은 길로 받는다.** 원본은 사람 경기도 같은 0xa8024(타석)·0xa7de8(경기 끝 승·패·세)을
 * 부르므로, 사람 경기 요약이 상대(와 로스터) 투수의 등판 줄을 `leaguePitcherAppearancesOf` 로 만들어
 * `recordLeaguePitcherAppearances` 에 넘기면 CPU 끼리 경기와 똑같이 쌓인다.
 */
export interface LeagueBatterLine {
  /** +0x20 타수 */
  readonly atBats: number
  /** +0x22 안타 */
  readonly hits: number
  /**
   * +0x24 2루타 · +0x26 3루타 — 정산 0xa8024 안타 가지가 루타 [sp+0x10] == 2 면 a8550, == 3 이면 a8592 에서 +1(9999 상한).
   * 홈런은 +0x28 이다. 옛 저장에는 없어 0 으로 본다.
   */
  readonly doubles?: number
  readonly triples?: number
  /** +0x28 홈런 */
  readonly homeRuns: number
  /** +0x2a 타점 */
  readonly runsBattedIn: number
  /**
   * +0x2c 도루 — 사람 경기 0xa8024(0xa8362~0xa8380, 도루 판 종류 5 에서 아무도 안 잡혔을 때 루를 옮긴 주자마다)와
   * CPU 경기 0xc1818 끝(0xc1a42~0xc1a98, 성공한 도루의 주자마다)이 올린다. 옛 저장에는 없어 0 으로 본다.
   */
  readonly steals?: number
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
   * ⚠️ **원본에서도 늘 0 이다 (원본 버그 그대로).** 세이브 후보는 교체 0xa60c0 이 잡지만, 같은 자리에서
   * 세이브 종류 코드 `state+0x64` 를 1·3·9 로 세우고 그 칸을 0 으로 되돌리는 코드가 없어 경기 끝 0xa7de8 의
   * `코드 > 0 이면 건너뜀`(0xa7eaa)에 늘 걸린다 (S1 4-1, CORRECTIONS 2-1). 판정은 `winLossSave` 가 원본대로 돌리고
   * 여기서는 그 결과(`'세'`)가 오면 그대로 +1 한다 — 실제로는 오지 않는다.
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
  /**
   * **붙박이 표 밖 선수**(시즌모드에 영입한 명전 0xb4~ · 나리 0xfe)의 이번 시즌 타자 줄 — 원본 id(+0) → 줄.
   *
   * 영입 0xc554 가 기록 0x30 바이트를 통째로 팀 레코드에 옮기고, 기록 함수 0xa8024 는 `0xa56dc(R, 선수, 0)` 이 참이면 그
   * 레코드 +0x20~ 에 쌓는다. 0xa56dc 의 모드 2 갈래(점프표 0xd8204[0] = 0xa56fa, 직접 떴다)는 시즌 객체 0x1f55d 의
   * +0x12c(국가대항전)·+0xb4(포스트시즌)가 0 이고 플래그 0 이면 선수가 마선수(0xb633d)가 아닐 때 참이다 — 명전·나리 선수는
   * 마선수 비트(+0xa 비트 6)가 없어 쌓인다. 순위표 0x9d789 도 마선수만 빼고 훑는다.
   * 그 선수들은 내 팀에만 있고(트레이드에서 거절된다) 명전 id 는 칸마다, 나리는 투수·타자 한 명씩이라 id 로 갈린다.
   * 옛 저장에는 없다 — 빈 표로 본다.
   */
  readonly recordBatters?: Readonly<Record<number, LeagueBatterLine>>
  /** 붙박이 표 밖 선수의 이번 시즌 투수 줄 — `recordBatters` 주석과 같다 */
  readonly recordPitchers?: Readonly<Record<number, LeaguePitcherLine>>
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
  /**
   * 그 타석에 **실제로 선 선수의 로스터 칸** (0~11) — 이름은 옛것이라 "타순" 이지만 타순 커서가 아니다.
   * 원본 타순은 명단 `team+0xe` 아홉 칸을 `mod 9` 로 돈다(`0xaf020`) — 벤치 셋(9~11)은 타순에 서지
   * 않는다. 부르는 쪽(`gameFlow`·`leagueDay`)이 타순 칸을 `mod 9` 로 접거나, CPU 대타(`0xac228`)로
   * 명단이 바뀌었으면 들어온 선수의 로스터 칸(벤치 9~11 일 수 있다)을 넘긴다.
   */
  readonly battingOrderIndex: number
  readonly outcome: AtBatOutcome
  readonly runsBattedIn: number
  /**
   * 붙박이 표 밖 선수(영입한 명전·나리)의 원본 id — 있으면 `battingOrderIndex` 대신 이 열쇠로
   * `recordBatters` 에 쌓는다 (`LeaguePlayerStats.recordBatters` 주석)
   */
  readonly recordId?: number
}

/**
 * 타자 전역 번호 — `팀 × 12 + 로스터 칸` (`teamRoster.teamBatters` 가 자르는 칸 그대로).
 * 받는 값은 이미 로스터 칸(0~11)이다(`LeaguePlateAppearance.battingOrderIndex` 주석). `% 12` 는
 * 칸을 돌려 쓰려는 것이 아니라 범위 밖·음수 값이 들어와도 표 밖을 가리키지 않게 감싸는 것뿐이다.
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
 * 섞인 레코드 차례(로테이션 0xb5ca8)와 상관없이 붙박이 표 칸으로 센다 — 기록은 레코드를 따라간다 (`League.pitcherOrders`).
 */
export function leaguePitcherIdOf(teamId: number, pitcherSlot: number): number {
  const slot = ((pitcherSlot % PITCHERS_PER_TEAM) + PITCHERS_PER_TEAM) % PITCHERS_PER_TEAM
  return teamId * PITCHERS_PER_TEAM + slot
}

/** 붙박이 표 밖 선수(영입한 명전·나리)의 이번 시즌 타자 줄 — 원본 id 로 (`recordBatters`) */
export function leagueRecordBatterLineOf(stats: LeaguePlayerStats, recordId: number): LeagueBatterLine {
  return stats.recordBatters?.[recordId] ?? EMPTY_LEAGUE_BATTER_LINE
}

/** 붙박이 표 밖 선수의 이번 시즌 투수 줄 — 원본 id 로 (`recordPitchers`) */
export function leagueRecordPitcherLineOf(stats: LeaguePlayerStats, recordId: number): LeaguePitcherLine {
  return stats.recordPitchers?.[recordId] ?? EMPTY_LEAGUE_PITCHER_LINE
}

/** 그 투수의 이번 시즌 성적. 한 번도 안 던졌으면(또는 옛 저장이면) 0 줄이다 */
export function leaguePitcherLineOf(stats: LeaguePlayerStats, pitcherId: number): LeaguePitcherLine {
  return stats.pitchers?.[pitcherId] ?? EMPTY_LEAGUE_PITCHER_LINE
}

/** 타석 하나를 한 줄에 더한다 (0xa8024 의 네 칸). 타수는 볼넷을 빼고 센다 */
/** +0x24·+0x26 의 상한 — a8552·a8594 `0x270f` */
const EXTRA_BASE_HIT_LIMIT = 9999

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
    ...(line.steals === undefined ? {} : { steals: line.steals }),
    // a8520~a85ac — 2루타 +0x24 · 3루타 +0x26 (9999 상한)
    ...(outcome.kind === '안타' && outcome.bases === 2
      ? { doubles: Math.min(EXTRA_BASE_HIT_LIMIT, (line.doubles ?? 0) + 1) }
      : line.doubles === undefined ? {} : { doubles: line.doubles }),
    ...(outcome.kind === '안타' && outcome.bases === 3
      ? { triples: Math.min(EXTRA_BASE_HIT_LIMIT, (line.triples ?? 0) + 1) }
      : line.triples === undefined ? {} : { triples: line.triples }),
  }
}

/** 도루 한 번 — 어느 팀 어느 로스터 칸(또는 표 밖 선수 id)의 주자가 한 루를 갔는가 */
export interface LeagueStolenBase {
  readonly teamId: number
  /** 그 주자의 로스터 칸 (`LeaguePlateAppearance.battingOrderIndex` 와 같은 뜻) */
  readonly battingOrderIndex: number
  /** 붙박이 표 밖 선수(영입한 명전·나리)의 원본 id */
  readonly recordId?: number
}

const addSteal = (line: LeagueBatterLine): LeagueBatterLine => ({ ...line, steals: (line.steals ?? 0) + 1 })

/** 도루를 +0x2c 에 쌓는다 (0xa8380 · 0xc1a98 — `strh` 라 s16, 실제로 넘칠 일은 없다) */
export function recordLeagueStolenBases(
  stats: LeaguePlayerStats,
  stolenBases: readonly LeagueStolenBase[],
): LeaguePlayerStats {
  if (stolenBases.length === 0) return stats
  const batters: Record<number, LeagueBatterLine> = { ...stats.batters }
  let recordBatters: Record<number, LeagueBatterLine> | undefined
  for (const steal of stolenBases) {
    if (steal.recordId !== undefined) {
      recordBatters ??= { ...stats.recordBatters }
      recordBatters[steal.recordId] = addSteal(recordBatters[steal.recordId] ?? EMPTY_LEAGUE_BATTER_LINE)
      continue
    }
    const id = leagueBatterIdOf(steal.teamId, steal.battingOrderIndex)
    batters[id] = addSteal(batters[id] ?? EMPTY_LEAGUE_BATTER_LINE)
  }
  return recordBatters === undefined ? { ...stats, batters } : { ...stats, batters, recordBatters }
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
  let recordBatters: Record<number, LeagueBatterLine> | undefined
  for (const appearance of plateAppearances) {
    if (appearance.recordId !== undefined) {
      recordBatters ??= { ...stats.recordBatters }
      recordBatters[appearance.recordId] = addPlateAppearance(
        recordBatters[appearance.recordId] ?? EMPTY_LEAGUE_BATTER_LINE,
        appearance.outcome,
        appearance.runsBattedIn,
      )
      continue
    }
    const id = leagueBatterIdOf(appearance.teamId, appearance.battingOrderIndex)
    batters[id] = addPlateAppearance(
      batters[id] ?? EMPTY_LEAGUE_BATTER_LINE,
      appearance.outcome,
      appearance.runsBattedIn,
    )
  }
  // 표 밖 선수가 없으면 칸을 만들지 않는다 — 예전 저장과 같은 모양
  return recordBatters === undefined ? { ...stats, batters } : { ...stats, batters, recordBatters }
}

/**
 * 등판 하나 — 어느 팀 투수 칸이 몇 아웃을 잡고 무엇을 내줬는가.
 * `simulateHalfInning` 의 `HalfInningResult` 가 반 이닝마다 내놓는 값을 그대로 모은 것이다.
 */
export interface LeaguePitcherAppearance {
  readonly teamId: number
  /** 로스터 투수 칸 (붙박이 표 칸 — 로테이션으로 섞여도 레코드를 따라간다) */
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
   * 경기 끝 0xa7de8 이 이 투수에게 매긴 것 — `state+0x44/0x48`(승)·`+0x50/0x54`(패)·`+0x5c/0x60`(세).
   * 판정은 `entities/game/model/winLossSave` (득점마다 0xa5c34 · 교체마다 0xa60c0) 그대로다. 없으면 `null`.
   * 한 레코드가 승과 패를 함께 받을 수 있어(국가대항전 CPU 경기는 두 팀이 레코드 하나를 같이 쓴다) 그때는
   * 줄이 둘이다 (`leaguePitcherAppearancesOf`).
   */
  readonly decision: LeaguePitcherDecision | null
  /** 붙박이 표 밖 선수(영입한 명전·나리)의 원본 id — 있으면 `recordPitchers` 에 쌓는다 */
  readonly recordId?: number
}

/** 경기 끝 0xa7de8 이 올리는 칸 — 승 +0x2e · 패 +0x2f · 세 +0x24 */
export type LeaguePitcherDecision = '승' | '패' | '세'

/** 한 경기에서 한 투수가 던진 줄 — 판정을 붙이기 전 */
export interface LeaguePitcherGameLine {
  readonly teamId: number
  readonly pitcherSlot: number
  readonly outs: number
  readonly runsAllowed: number
  readonly strikeouts: number
  readonly pitches: number
  /** 붙박이 표 밖 선수의 원본 id (`LeaguePitcherAppearance.recordId`) */
  readonly recordId?: number
}

/** 경기 끝 판정 하나 — 측(0 = 초 공격 칸 · 1 = 말 공격 칸)과 그 칸 팀의 투수 칸 */
export interface LeaguePitcherOfRecord {
  readonly side: number
  readonly pitcherSlot: number
  /**
   * 그 투수의 **붙박이 표 팀** — 트레이드로 다른 팀 레코드에 옮겨 간 투수는 기록이 옛 표 자리(원본 id)로 쌓이므로
   * 부르는 쪽이 칸과 함께 표 팀을 넘긴다. 없으면 `teamOfSide(측)` 이다.
   */
  readonly teamId?: number
  /** 붙박이 표 밖 선수의 원본 id — 줄과 같은 열쇠로 찾는다 (`LeaguePitcherAppearance.recordId`) */
  readonly recordId?: number
}

/**
 * 한 경기의 투수 줄에 경기 끝 판정(0xa7de8)을 붙인다 — CPU 끼리 경기(`simulateLeagueGame`)와 사람 경기 요약이
 * 같이 쓴다. `teamOfSide(측)` 은 그 측(state 칸)에서 **던진** 팀 번호다.
 *
 * 판정 받은 투수에게 줄이 없으면(던지지 않았는데 그 순간 마운드에 서 있던 투수) 0 줄을 하나 만들어 붙이고,
 * 이미 다른 판정을 받은 줄이면 0 줄을 하나 더 붙인다 — 원본은 레코드 칸을 따로 올리므로 둘 다 남는다.
 * `skip` 이 참인 칸(마선수 8번처럼 다음 경기에 덮이는 칸)은 판정도 줄도 쌓지 않는다.
 */
export function leaguePitcherAppearancesOf(
  lines: readonly LeaguePitcherGameLine[],
  decisions: {
    readonly winner: LeaguePitcherOfRecord | null
    readonly loser: LeaguePitcherOfRecord | null
    readonly save: LeaguePitcherOfRecord | null
  },
  teamOfSide: (side: number) => number,
  skip: (teamId: number, pitcherSlot: number, recordId?: number) => boolean = () => false,
): LeaguePitcherAppearance[] {
  const appearances: LeaguePitcherAppearance[] = lines
    .filter((line) => !skip(line.teamId, line.pitcherSlot, line.recordId))
    .map((line) => ({ ...line, decision: null }))
  const attach = (record: LeaguePitcherOfRecord | null, decision: LeaguePitcherDecision) => {
    if (record === null) return
    const teamId = record.teamId ?? teamOfSide(record.side)
    if (skip(teamId, record.pitcherSlot, record.recordId)) return
    const index = appearances.findIndex(
      (appearance) =>
        appearance.teamId === teamId
        && appearance.pitcherSlot === record.pitcherSlot
        && appearance.recordId === record.recordId,
    )
    const found = index < 0 ? undefined : appearances[index]
    if (found !== undefined && found.decision === null) {
      appearances[index] = { ...found, decision }
      return
    }
    appearances.push({
      teamId,
      pitcherSlot: record.pitcherSlot,
      outs: 0,
      runsAllowed: 0,
      strikeouts: 0,
      pitches: 0,
      decision,
      ...(record.recordId === undefined ? {} : { recordId: record.recordId }),
    })
  }
  attach(decisions.winner, '승')
  attach(decisions.loser, '패')
  attach(decisions.save, '세')
  return appearances
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
    // 원본에서 세이브는 늘 0 이다 — 판정이 `'세'` 를 내지 않는다 (`LeaguePitcherLine.saves` 주석)
    saves: line.saves + (appearance.decision === '세' ? 1 : 0),
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
  let recordPitchers: Record<number, LeaguePitcherLine> | undefined
  for (const appearance of appearances) {
    if (appearance.recordId !== undefined) {
      recordPitchers ??= { ...stats.recordPitchers }
      recordPitchers[appearance.recordId] = addPitcherAppearance(
        recordPitchers[appearance.recordId] ?? EMPTY_LEAGUE_PITCHER_LINE,
        appearance,
      )
      continue
    }
    const id = leaguePitcherIdOf(appearance.teamId, appearance.pitcherSlot)
    pitchers[id] = addPitcherAppearance(pitchers[id] ?? EMPTY_LEAGUE_PITCHER_LINE, appearance)
  }
  return recordPitchers === undefined ? { ...stats, pitchers } : { ...stats, pitchers, recordPitchers }
}
