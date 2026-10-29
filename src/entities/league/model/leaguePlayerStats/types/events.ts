import type { AtBatOutcome } from '@/entities/league/model/leaguePlayerStats/otherSlices'

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

/** 도루 한 번 — 어느 팀 어느 로스터 칸(또는 표 밖 선수 id)의 주자가 한 루를 갔는가 */
export interface LeagueStolenBase {
  readonly teamId: number
  /** 그 주자의 로스터 칸 (`LeaguePlateAppearance.battingOrderIndex` 와 같은 뜻) */
  readonly battingOrderIndex: number
  /** 붙박이 표 밖 선수(영입한 명전·나리)의 원본 id */
  readonly recordId?: number
}

/** 실책 한 번 — 어느 팀 어느 로스터 칸(또는 표 밖 선수 id)의 야수 레코드(+0xec)에 매기는가 */
export interface LeagueFieldingError {
  readonly teamId: number
  /** 그 야수 레코드의 로스터 칸 (`LeaguePlateAppearance.battingOrderIndex` 와 같은 뜻) */
  readonly battingOrderIndex: number
  /** 붙박이 표 밖 선수(영입한 명전·나리)의 원본 id */
  readonly recordId?: number
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

/** 사사구를 낸 투수 줄 — `GamePitcherLine` 의 `walks` 칸만 본다 */
export interface LeaguePitcherWalkLine {
  readonly teamId: number
  readonly pitcherSlot: number
  readonly recordId?: number
  readonly walks?: number
}
