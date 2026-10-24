import { HALL_OF_FAME_FIRST_ID, tableTeamOf } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import { TRADE_TAB, tradeRefusalOf } from '@/entities/season-mode/model/playerTrade'
import {
  SEASON_RECORD_ACE_BATTER_SLOT, SEASON_RECORD_ACE_PITCHER_SLOT, seatAce, tableRosterOf,
} from '@/entities/season-mode/model/seasonEntry'
import type { SeasonRecordAces } from '@/entities/season-mode/model/seasonEntry'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { LEAGUE_TEAM_COUNT } from '@/entities/league/model/league'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * CPU 트레이드 요청 — 경기 뒤 마무리 **0xf1** 에 들어갈 때(`0x953c`) 굴린다. 직접 떴다 (0x93c8~0x9518).
 *
 * ```
 * 0x953c  req = 0x93c8(this) → this+0x148 에 20바이트 복사 ; 0x6ea6d(소리, 4, −1, 1) 배경음 4
 * 0x93c8  memset(req, 0, 0x14)
 *         bfa55(0, 10000) < 1000 → req+0 = 1                         ; 10%
 *         req+0 == 0 이면 끝
 *         SR+0x17a (s16) += 1                                        ; 요청 횟수 — 아래에서 실패해도 남는다
 *         do req+0x10 = bfa55(0, 10) while == SR[1]                 ; 상대 팀 (내 팀 제외)
 *         T = 0x1f570(저장, req+0x10)                               ; 상대 팀 레코드
 *   A:    req+0xc = bfa55(0, 2)                                       ; 탭
 *         req+8   = bfa55(0, 탭 == 0 ? 8 : 12)                       ; 상대 선수 칸
 *         p = 0xb5695(T, 탭, req+8) ; 0xb6389(p) || 0xb6349(p) → A    ; 나리·명전이면 탭부터 다시
 *         n = 0
 *   B:    req+4 = bfa55(0, 탭 == 0 ? 8 : 12)                         ; 내 선수 칸
 *         m = 0xb5695(내 팀 레코드, 탭, req+4)
 *         m.+0x1b × 10 ≥ p.+0x1b × 10 이고 0xb6389(m)·0xb6349(m) 둘 다 거짓 → 끝 (요청 선다)
 *         n == (탭 == 0 ? 8 : 12) 이면 req+0 = 0 (요청 사라짐) · 끝 ; 아니면 n += 1, B
 * ```
 * - **내 선수는 타자 13번 · 투수 9번까지 뽑는다** — 검사(`n == 8|12`)가 뽑은 **뒤**에 있어서다(J 4-5 의 8/12 는 한 번 모자란다).
 * - **탭 0 = 투수 · 1 = 타자**다. `0xb5695(팀, 탭, i)` 는 탭 0 이면 `0xb51fc`(팀[+0x14] 투수 배열, 수 [+0xc] = 8),
 *   1 이면 `0xb53d0`(팀[+0x18] 타자 배열, 수 [+0x10] = 12) — 뽑는 범위 8 · 12 와도 맞는다(J 4-5 의 "탭 0 타자" 는 반대).
 * - 굴림은 장면 생성마다 0 이 되는 장면 객체 칸(this+0x148)에 담기고 **저장되지 않는다** — 요청 횟수 SR+0x17a 만 남는다.
 * - 요청은 관리 메뉴(0xc9)에 들어갈 때 알림 StrMODE[203] 으로 뜬다(0xec10, `useSeasonSession`).
 *   홀수 경기 뒤(0xf1 → 0xd8)는 관리 메뉴를 안 지나 그대로 묻히고, 다음 0xf1 이 새로 굴려 덮는다.
 *
 * 상대 팀 레코드는 시즌 저장의 CPU 팀 명단(지난 트레이드로 바뀐 팀만 저장에 있고 나머지는 붙박이 표 —
 * `useSeasonSession` 의 `cpuRosters`)을 부르는 쪽이 넘긴다. 표에는 나리·명전 선수가 없어 A 는 한 번에 끝나지만, 트레이드로
 * 옮겨 간 선수도 리그 선수라 마찬가지다.
 *
 * 나리·명전 판정은 `tradeRefusalOf`(0xb6389 · 0xb6349 그대로)로 본다.
 *
 * **레코드에 남은 마선수** (U-105 r154 — 직접 떴다): 0xf1 은 경기 끝 0x4ea0c 뒤라 그날 0xdd 진입 0x6548 · CPU 끼리 0xc239c 가 넣은
 * 마선수가 열 팀 레코드에 모두 남아 있다(빼는 `0xb512c` 는 0xdf · 0xe5 진입만 부른다 — `SeasonRecordAces`). 그래서 `0xb5695` 가
 * 보는 배열은 투수 [0..7, 마투수, 옛 8…] · 타자 [0..8, 마타자, 10, 11, …, 옛 9] 이고, 뽑기 범위 0..7 · 0..11 에서
 * **타자 9번을 뽑으면 마타자**다. 마선수 +0xa 는 0x40 | 순번(비트7 없음)이고 0xb6349 는 마선수 비트면 거짓이라 거절되지 않으며,
 * +0x1b 는 XlsACE_BAT_DATA 행 바이트 27 그대로다(`ACE_BATTER_RECORD_GRADES`). 요청 [203] 예 → 0xe5 진입 0x5cd0 이 먼저
 * `0xb512c` 로 마선수를 빼 옛 9번이 9번 칸에 돌아오므로, 요청 칸 9 는 화면에서 **옛 9번 선수**를 가리킨다(원본 그대로 —
 * 마선수가 트레이드되는 일은 없다). 굴림 개수 규칙은 같고, 9번 칸의 +0x1b 가 바뀌어 B 고리가 끝나는 차례가 달라질 수 있다.
 */
export interface TradeRequest {
  /** +0 — 요청이 섰는가 (트레이드 진행 0xcf24 의 강제 성공 플래그로도 쓰인다) */
  readonly isRequested: boolean
  /** +4 — 상대가 원하는 내 선수 칸 (내 팀 명단 차례) */
  readonly myIndex: number
  /** +8 — 상대가 내주는 선수 칸 (상대 팀 명단 차례) */
  readonly opponentIndex: number
  /** +0xc — 탭: 0 투수 · 1 타자 */
  readonly tab: number
  /** +0x10 — 요청한 팀 */
  readonly opponentTeamId: number
}

/** memset(req, 0, 0x14) 그대로 — 요청 없음 */
export const NO_TRADE_REQUEST: TradeRequest = {
  isRequested: false, myIndex: 0, opponentIndex: 0, tab: 0, opponentTeamId: 0,
}

/** 요청 확률 — `bfa55(0, 10000) < 1000` (93da~93ec) */
export const TRADE_REQUEST_ROLL_RANGE = 10000
export const TRADE_REQUEST_THRESHOLD = 1000

/** 탭 0 = 투수 (0xb51fc) · 1 = 타자 (0xb53d0) — `playerTrade.TRADE_TAB` 와 같은 값 */
export const TRADE_REQUEST_TAB = TRADE_TAB
/** 탭별 뽑기 범위 — `탭 == 0 ? 8 : 12` (9446·9488) */
export const TRADE_REQUEST_PITCHER_RANGE = 8
export const TRADE_REQUEST_BATTER_RANGE = 12

/**
 * 마선수 레코드 +0x1b — 저장의 마선수 레코드(`0x1f825` · `0x1f84d` = 앱 데이터 +0xc64 …, 0x20094 6번 갈래가 XlsACE_* 행을 통째
 * 부은 것)의 행 바이트 27. XlsACE_BAT_DATA 메디카 · 어거지죠 · 로제 · 크라이져 · 킹타이거 / XlsACE_PIT_DATA 싸이커 · 레오니 ·
 * 붕붕머신 · 발렌타인 · 드래고나 (base/extracted 행에서 읽음 — `acePlayers.ts` 생성기에는 이 칸이 없다)
 */
export const ACE_BATTER_RECORD_GRADES: readonly number[] = [20, 30, 40, 50, 40]
export const ACE_PITCHER_RECORD_GRADES: readonly number[] = [50, 40, 30, 20, 10]

/** `0xb5695(팀, 탭, i)` 가 돌려주는 줄 — 명단 선수이거나 레코드에 남은 마선수 */
export type TradeRecordRow =
  | { readonly kind: '선수'; readonly player: SeasonPlayer }
  | { readonly kind: '마선수'; readonly aceIndex: number }

/**
 * 한 팀 레코드의 탭 배열 — 명단 차례(투수는 레코드 차례로 넘긴다)에 레코드에 남은 마선수를 원본 넣기(`0xb521c` 0x60 ·
 * `0xb53f0` 0x40 갈래 — 옛 칸은 맨 끝으로)대로 앉힌 모양.
 */
export function tradeRecordRowsOf(roster: SeasonTeamRoster, tab: number, aces?: SeasonRecordAces): readonly TradeRecordRow[] {
  const rows: TradeRecordRow[] = tradeTabPlayersOf(roster, tab).map((player) => ({ kind: '선수', player }))
  const isPitcherTab = tab === TRADE_REQUEST_TAB.투수
  const ace = aces === undefined ? -1 : isPitcherTab ? aces.pitcher : aces.batter
  if (ace < 0) return rows
  return seatAce<TradeRecordRow>(
    rows,
    isPitcherTab ? SEASON_RECORD_ACE_PITCHER_SLOT : SEASON_RECORD_ACE_BATTER_SLOT,
    { kind: '마선수', aceIndex: ace },
  )
}

/** 줄의 +0x1b 와 거절 여부(0xb6389 · 0xb6349) — 마선수는 둘 다 거짓 */
function rowGradeOf(teamId: number, tab: number, row: TradeRecordRow | undefined): { grade: number; refused: boolean } | undefined {
  if (row === undefined) return undefined
  if (row.kind === '마선수') {
    const grades = tab === TRADE_REQUEST_TAB.투수 ? ACE_PITCHER_RECORD_GRADES : ACE_BATTER_RECORD_GRADES
    return { grade: grades[row.aceIndex] ?? 0, refused: false }
  }
  return { grade: playerGradeOf(teamId, tab, row.player), refused: tradeRefusalOf(row.player) !== null }
}

const rangeOf = (tab: number) =>
  tab === TRADE_REQUEST_TAB.투수 ? TRADE_REQUEST_PITCHER_RANGE : TRADE_REQUEST_BATTER_RANGE

/**
 * 시즌 명단 선수의 레코드 +0x1b. 원본은 그 선수 레코드 바이트를 바로 읽는다 — 리그 선수(id < 0xb4)의 레코드는 Xls 행
 * 사본이라, 웹은 그 선수의 **붙박이 표 팀**(`tableTeamOf` — 트레이드로 옮겨 온 선수는 옛 팀) 표의 id 번째 값을 읽는다.
 * 영입한 나리·명전 선수는 표에 없어 0 으로 보지만, 그 선수는 나리·명전 검사에서 어차피 떨어지므로 결과에 닿지 않는다.
 */
export function playerGradeOf(ownerTeamId: number, tab: number, player: SeasonPlayer): number {
  if (player.id >= HALL_OF_FAME_FIRST_ID) return 0
  const team = tableTeamOf(player, ownerTeamId)
  const table = tab === TRADE_REQUEST_TAB.투수 ? teamPitchers(team) : teamBatters(team)
  return table[player.id]?.grade ?? 0
}

/** 탭의 명단 배열 — `0xb5695(팀, 탭, i)` */
export function tradeTabPlayersOf(roster: SeasonTeamRoster, tab: number): readonly SeasonPlayer[] {
  return tab === TRADE_REQUEST_TAB.투수 ? roster.pitchers : roster.batters
}

export interface TradeRequestRoll {
  readonly request: TradeRequest
  /** SR+0x17a 를 올린 레코드 (요청이 안 서면 그대로) */
  readonly record: SeasonRecord
}

/**
 * 0x93c8 한 번 — 위 머리 주석의 굴림 차례 그대로.
 * `opponentRosterOf` 는 상대 팀 레코드(`0x1f570(저장, 팀)`) — 안 주면 붙박이 표 명단이다.
 */
export function rollTradeRequest(
  random: RandomPort,
  record: SeasonRecord,
  roster: SeasonTeamRoster,
  opponentRosterOf: (teamId: number) => SeasonTeamRoster = tableRosterOf,
  /** 팀 레코드에 남은 마선수 (`SeasonSave.recordAces`) — 안 주면 없음 */
  recordAcesOf: (teamId: number) => SeasonRecordAces | undefined = () => undefined,
): TradeRequestRoll {
  if (random.rand(0, TRADE_REQUEST_ROLL_RANGE) >= TRADE_REQUEST_THRESHOLD) {
    return { request: NO_TRADE_REQUEST, record }
  }
  const counted: SeasonRecord = { ...record, tradeRequestCount: record.tradeRequestCount + 1 }

  let opponentTeamId = random.rand(0, LEAGUE_TEAM_COUNT)
  while (opponentTeamId === record.teamId) opponentTeamId = random.rand(0, LEAGUE_TEAM_COUNT)

  // A — 상대 선수가 나리·명전이면 탭부터 다시 (리그 열 팀 레코드에는 없어 한 번에 끝난다)
  const opponentRoster = opponentRosterOf(opponentTeamId)
  const opponentAces = recordAcesOf(opponentTeamId)
  let tab: number
  let opponentIndex: number
  let opponent: ReturnType<typeof rowGradeOf>
  do {
    tab = random.rand(0, 2)
    opponentIndex = random.rand(0, rangeOf(tab))
    // 0xb5695 — 레코드에 남은 마선수가 앉은 배열 (타자 9번 = 마타자)
    opponent = rowGradeOf(opponentTeamId, tab, tradeRecordRowsOf(opponentRoster, tab, opponentAces)[opponentIndex])
  } while (opponent !== undefined && opponent.refused)

  // 웹 CPU 명단은 늘 8·12 명이라 비는 칸은 없다 (원본은 0xb5695 가 0 을 돌려 그 +0x1b 를 읽는다)
  const opponentGrade = opponent?.grade ?? 0
  const mine = tradeRecordRowsOf(roster, tab, recordAcesOf(record.teamId))
  const limit = rangeOf(tab)
  // B — 뽑고 나서 n 을 본다: 0..limit 로 limit + 1 번
  for (let tries = 0; ; tries += 1) {
    const myIndex = random.rand(0, limit)
    const player = rowGradeOf(record.teamId, tab, mine[myIndex])
    // 웹 명단은 늘 8·12 명 이상이라 비는 칸은 없다 (원본은 0xb5695 가 0 을 돌려 그 +0x1b 를 읽는다)
    const fits = player !== undefined && player.grade >= opponentGrade && !player.refused
    if (fits) {
      return { request: { isRequested: true, myIndex, opponentIndex, tab, opponentTeamId }, record: counted }
    }
    if (tries === limit) {
      // 요청은 사라지지만 나머지 칸(탭·팀·칸)은 마지막 값으로 남는다 — 플래그만 0 (9502)
      return { request: { isRequested: false, myIndex, opponentIndex, tab, opponentTeamId }, record: counted }
    }
  }
}
