/** 타자 한 줄 — 교환 규칙이 보는 칸만 */
export interface EntryBatterRow {
  /** 마선수인가 (`0xb633d`) */
  readonly isAce: boolean
  /** 수비 위치 = 레코드 `+0x1c & 0xf` — **0 은 벤치** */
  readonly position: number
}

/** 투수 한 줄 */
export interface EntryPitcherRow {
  readonly isAce: boolean
}

/** 타자 레코드 +0x20~+0x2e — 엔트리 목록 창 기록 열(0x56ebd)이 읽는 칸 */
export interface EntryBatterLine {
  readonly atBats: number
  readonly hits: number
  readonly doubles: number
  readonly triples: number
  readonly homeRuns: number
  readonly runsBattedIn: number
  /** +0x2c */
  readonly steals: number
  /** +0x2e — 머리 글 212 "실책" */
  readonly errors: number
}

/** 투수 레코드 +0x20~+0x2f */
export interface EntryPitcherLine {
  readonly outs: number
  readonly runsAllowed: number
  readonly saves: number
  readonly strikeouts: number
  readonly pitches: number
  /** +0x2a — 머리 글 219 "사사구" */
  readonly walks: number
  /** s8 +0x2e */
  readonly wins: number
  /** s8 +0x2f */
  readonly losses: number
}

/**
 * **'0' 상세 창 0x5b798 이 레코드에서 읽는 칸** — 엔트리 목록 창 0x5c984 끝(0x5cfc8)이 커서 줄 레코드를 넘긴다
 * (`widgets/player-detail-window` 가 글로 바꾼다).
 */
export interface PlayerDetailSource {
  readonly isPitcher: boolean
  /** 도형 값 `0xb6414(rec, k, 1)` */
  readonly abilities: readonly number[]
  /** 마선수 순번 0~4 (0xb63a0), 아니면 −1 */
  readonly aceIndex: number
  /** +0xb — 타자 타입(>> 5) · 타자 손(비트 4, 0xb63c0). 모르면 0 */
  readonly profile: number
  /** +0x14 장착 스킬 비트 */
  readonly skillBits: number
  /** 타자 +0x18 고른 필살 번호 (0 없음) */
  readonly specialNumber?: number
  /** 투수 폼(+0xb >> 4) · 마구(+0x18) · 구질 마스크(+0x1c) */
  readonly repertoire?: { readonly form: number; readonly magicNumber: number; readonly pitchMask: number }
  /** +0x1b 등급 — 연봉 = ×1000. 모르면 null */
  readonly grade: number | null
  /**
   * 육성 선수(+0xa 비트 7, 0xb6388)의 연봉 칸 — 모드 3 · 4 면 +0x1b 대신 저장 0x1f8d5(모드) **+0x1c8 u16 × 100** 을 찍는다
   * (0x5b798 5c848~5c886). 나리 143 · 124 의 내 선수 줄만 든다(커리어 `salary` = S+0x1c8)
   */
  readonly nurturedSalary?: number
}

/**
 * Xls 행 바이트 32~43(+0x20~+0x2a) 시즌 줄 여섯 칸 → 레코드 줄 — 타자 [타수, 안타, 2루타, 3루타, 홈런, 타점] ·
 * 투수 [잡은 아웃, 실점, 세이브, 탈삼진, 투구 수, +0x2a]. 행 바이트 44~47 은 타자 0 · 투수 스태미나 10000 · 승패 0 이다
 * (XlsBATTER_DATA · XlsPITCHER_DATA 를 직접 읽었다).
 */
export function entryBatterLineOfRecord(recordLine: readonly number[]): EntryBatterLine {
  const at = (i: number) => recordLine[i] ?? 0
  return { atBats: at(0), hits: at(1), doubles: at(2), triples: at(3), homeRuns: at(4), runsBattedIn: at(5), steals: 0, errors: 0 }
}

export function entryPitcherLineOfRecord(recordLine: readonly number[]): EntryPitcherLine {
  const at = (i: number) => recordLine[i] ?? 0
  return { outs: at(0), runsAllowed: at(1), saves: at(2), strikeouts: at(3), pitches: at(4), walks: at(5), wins: 0, losses: 0 }
}

/** 편집기가 들고 있는 팀 레코드의 두 배열 — 타자 `[팀+0x18]` · 투수 `[팀+0x14]` 순서 그대로 */
export interface EntryLists<B extends EntryBatterRow, P extends EntryPitcherRow> {
  readonly batters: readonly B[]
  readonly pitchers: readonly P[]
}
