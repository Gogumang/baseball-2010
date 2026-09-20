/**
 * 개인 순위표 (binary.mod 0x9d789 — B-season-awards.md 4절 2번 "개인 타이틀", **확정**).
 *
 * 원본은 시상할 때마다 **10팀 × 그 팀의 타자/투수 전원**을 훑어 상위 10명을 뽑는다.
 * 팀 명단은 0xb53d1(타자 +0x10 개수) · 0xb51fd(투수 +0xc 개수)로 읽고,
 * 선수 레코드의 칸을 종류별로 꺼내 큰 쪽부터(방어율만 작은 쪽부터) 끼워 넣는다.
 *
 * ⚠️ **선행 조건 — 웹에는 CPU 선수의 개인 성적이 없다.**
 * 원본은 CPU 끼리 경기(0xc2a48)도 사람 경기(0xae24c·0xae3e8)와 **같은 타석 기록 함수 0xa8024**
 * 를 불러 선수 레코드마다 홈런(+0x28)·타점(+0x2a)·타수(+0x20)를 쌓는다. 그래서 45경기가 끝나면
 * 리그 300명 전원에게 시즌 성적이 있다 (B-2 마지막 문단, 확정).
 * 웹의 `entities/league/model/leagueDay.ts` 는 같은 간이 타석 엔진을 돌리면서도 **점수만 읽고 버린다**.
 * `shared/config/original/roster.ts` 도 이름·능력치 네 칸뿐이라 성적을 담을 곳이 아예 없다
 * (`playerCareer.ts` 의 `startNextSeason` 주석도 같은 사실을 적어 두었다).
 *
 * → 그래서 이 파일은 **기록표를 인자로 받는 순수 함수**로만 만들었다. 성적을 지어내지 않는다.
 *   기록표가 비면 1위가 없어 수상도 없다 (지금 웹의 상태). CPU 성적을 쌓는 곳은 `leagueDay.ts`
 *   (`simulateLeagueGame` 이 타석 결과를 버리는 자리)이고, 시즌 전환 때 비우는 곳은
 *   `playerCareer.ts` 의 `startNextSeason` 이다 — 그 두 곳이 채워지면 여기 인자로 넘기면 된다.
 */

/** 순위표 종류 (점프표 0xd7398). 원본 번호를 그대로 쓴다 */
export const LEADER_KIND = {
  승: 1,
  패: 2,
  세이브: 3,
  방어율: 4,
  탈삼진: 6,
  홈런: 9,
  타점: 11,
  타율: 12,
} as const

export type LeaderKind = (typeof LEADER_KIND)[keyof typeof LEADER_KIND]

/**
 * 순위표가 보는 선수 레코드 한 줄. 칸 이름 옆이 원본 오프셋이다 (0x9d789 가 읽는 칸들).
 * 투수 칸과 타자 칸이 한 레코드에 겹쳐 있는 것도 원본 그대로다.
 */
export interface LeagueRecord {
  /** 소속 팀 번호 (1위 발표에 쓴다 — 0x9da21) */
  readonly teamId: number
  readonly name: string
  /** 내 육성 선수인가 — 레코드 +0xa 의 **부호 비트** (0xb6389). 수상 판정이 이 비트만 본다 */
  readonly isMine: boolean
  /** 순위표에서 빼는 선수 — 레코드 +0xa 의 **비트6** (0xb633c) */
  readonly isOutOfRanking: boolean
  /** +0x20 — 타자는 타수, 투수는 잡은 아웃 수. **0 이하면 순위표에서 뺀다** */
  readonly atBatsOrOuts: number
  /** +0x22 — 타자는 안타, 투수는 피안타(종류 5·8) */
  readonly hits: number
  /** +0x24 세이브 */
  readonly saves: number
  /** +0x26 탈삼진 */
  readonly strikeouts: number
  /** +0x28 홈런 */
  readonly homeRuns: number
  /** +0x2a 타점 */
  readonly runsBattedIn: number
  /** +0x2c — 타자 쪽 종류 10 이 보는 칸 (뜻 미확인) */
  readonly batterExtra: number
  /** 방어율(0xb6ce9) 계산에 쓰는 자책점 */
  readonly earnedRuns: number
  /** +0x2e 승 */
  readonly wins: number
  /** +0x2f 패 */
  readonly losses: number
}

export const EMPTY_LEAGUE_RECORD: LeagueRecord = {
  teamId: 0,
  name: '',
  isMine: false,
  isOutOfRanking: false,
  atBatsOrOuts: 0,
  hits: 0,
  saves: 0,
  strikeouts: 0,
  homeRuns: 0,
  runsBattedIn: 0,
  batterExtra: 0,
  earnedRuns: 0,
  wins: 0,
  losses: 0,
}

/**
 * 규정 타석·이닝. 0x9d789 의 **다섯째 인자가 1** 이면 0x9d7d0 이 `0x68`(104)·`0x2d`(45)를
 * 그대로 쓴다 — 시상은 늘 이 경로다. (0 이면 경기 수 g 로 `trunc((23g+9)/10)` 타수 · g 이닝)
 */
export const QUALIFIED_AT_BATS = 104
export const QUALIFIED_INNINGS = 45

/** 원본 순위표 칸 수 — 상위 10명까지만 들고 있는다 */
export const LEADERBOARD_SIZE = 10

/** 원본 타율은 1000 배 정수다 */
export const BATTING_AVERAGE_SCALE = 1000

/** 타율 0xb8e3d = `min(1000, trunc(안타 × 1000 / 타수))`. 타수 0 이면 타율이 없다 */
export function battingAverageOf(record: LeagueRecord): number | null {
  if (record.atBatsOrOuts <= 0) return null
  return Math.min(
    BATTING_AVERAGE_SCALE,
    Math.trunc((record.hits * BATTING_AVERAGE_SCALE) / record.atBatsOrOuts),
  )
}

/**
 * 방어율 (0xb6ce9) — **자책점 × 27 / 아웃** 을 100 배 정수로 둔다.
 * ⚠️ B 문서가 "0xb6ce9, 오름차순" 까지만 확정하고 **식 자체는 적지 않았다** → 야구의 표준식
 * (자책점 × 9이닝 / 이닝, 이닝 = 아웃/3)을 정수로 옮긴 **추정**이다. 순위만 쓰므로 배율은 결과에
 * 영향이 없고, 원본 식이 밝혀지면 이 함수 하나만 고치면 된다.
 */
export const EARNED_RUN_AVERAGE_SCALE = 100
const OUTS_PER_INNING = 3

export function earnedRunAverageOf(record: LeagueRecord): number | null {
  if (record.atBatsOrOuts <= 0) return null
  return Math.trunc(
    (record.earnedRuns * OUTS_PER_INNING * 9 * EARNED_RUN_AVERAGE_SCALE) / record.atBatsOrOuts,
  )
}

/** 방어율만 **작은 쪽이 1위**다 (0x9d789 의 오름차순 분기) */
export function isAscending(kind: LeaderKind): boolean {
  return kind === LEADER_KIND.방어율
}

/**
 * 순위표에 넣을 값. `null` 이면 그 선수는 이 종류에 끼지 못한다.
 * 제외 조건 두 가지(`+0x20 ≤ 0` · `+0xa 비트6`)는 종류와 무관하게 먼저 본다.
 */
export function leaderValueOf(record: LeagueRecord, kind: LeaderKind): number | null {
  if (record.isOutOfRanking) return null
  if (record.atBatsOrOuts <= 0) return null

  switch (kind) {
    case LEADER_KIND.승:
      return record.wins
    case LEADER_KIND.패:
      return record.losses
    case LEADER_KIND.세이브:
      return record.saves
    case LEADER_KIND.방어율:
      // 규정 이닝 — 원본은 `아웃 / 3 ≥ 45` 로 본다 (버림)
      return Math.trunc(record.atBatsOrOuts / OUTS_PER_INNING) >= QUALIFIED_INNINGS
        ? earnedRunAverageOf(record)
        : null
    case LEADER_KIND.탈삼진:
      return record.strikeouts
    case LEADER_KIND.홈런:
      return record.homeRuns
    case LEADER_KIND.타점:
      return record.runsBattedIn
    case LEADER_KIND.타율:
      // 규정 타수 104
      return record.atBatsOrOuts >= QUALIFIED_AT_BATS ? battingAverageOf(record) : null
    default:
      return null
  }
}

export interface LeaderEntry {
  readonly record: LeagueRecord
  readonly value: number
}

/**
 * 상위 10명 (0x9d789).
 *
 * 원본은 칸 10개를 훑다가 **"기존 칸이 새 값보다 좋거나 같으면 끼우지 않고" 다음 칸으로** 넘어간다.
 * 그래서 **동점이면 먼저 들어간 쪽(= 팀 번호·팀 안 선수 순서가 앞선 쪽)이 1위**다.
 * `records` 의 순서가 곧 그 순회 순서이므로, 부르는 쪽이 팀 0부터 명단 순서대로 넘겨야 한다.
 */
export function rankLeaders(
  records: readonly LeagueRecord[],
  kind: LeaderKind,
): readonly LeaderEntry[] {
  const ascending = isAscending(kind)
  const better = (candidate: number, seated: number) =>
    ascending ? candidate < seated : candidate > seated

  const leaders: LeaderEntry[] = []
  for (const record of records) {
    const value = leaderValueOf(record, kind)
    if (value === null) continue

    const slot = leaders.findIndex((entry) => better(value, entry.value))
    if (slot < 0) {
      if (leaders.length < LEADERBOARD_SIZE) leaders.push({ record, value })
      continue
    }
    leaders.splice(slot, 0, { record, value })
    if (leaders.length > LEADERBOARD_SIZE) leaders.pop()
  }
  return leaders
}

/** 1위 한 명. 자격을 갖춘 선수가 하나도 없으면 null */
export function leaderOf(
  records: readonly LeagueRecord[],
  kind: LeaderKind,
): LeaderEntry | null {
  return rankLeaders(records, kind)[0] ?? null
}
