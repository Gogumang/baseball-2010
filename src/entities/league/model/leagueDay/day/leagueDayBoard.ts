import type { League } from '@/entities/league/model/league'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import type { LeagueGameAces } from '@/entities/league/model/leagueDay/types/leagueGameExtras'

/** 점수 칸 초기값 — 경기 객체 +8 을 0x50 바이트 −1 로 채운다(c2a6a). 내 경기 줄은 이 값으로 남는다 */
export const LEAGUE_DAY_NO_SCORE = -1

/**
 * 하루 대진·점수표 — 0xc2a48 의 경기 객체 **+8 ~ +0x57 (s32 × 20)** 그대로다 (직접 떴다).
 * ```
 * c2a66  memset(+8, −1, 0x50)
 * c2a7a  팀 t = 0..9, 칸 k = 0..4: t 가 A[k]·B[k] 에 없고 A[k] == −1 이면
 *          0xb7844(L, t) == 1 → A[k] = t, B[k] = 상대 0xb765c(L, t)
 *          그 밖           → B[k] = t, A[k] = 상대
 * c2aee  칸 k = 0..4: A[k]·B[k] 가 내 팀이면 건너뛴다 — 점수 두 칸이 −1 로 남는다
 *          scoreA[k] = 0xb69b0(경기, side(B[k]))   ; c2b8a — 칸 sY(= 0)에서 친 것 = A 명단의 득점
 *          scoreB[k] = 0xb69b0(경기, side(A[k]))   ; c2b9a — 칸 sX(= 1)에서 친 것 = B 명단의 득점
 *          scoreA > scoreB → A 승 · 그 밖 B 승     ; c2ba6
 * c2be0  모드 2 이고 L+0xac(국가대항전)·L+0x34(포스트시즌)가 둘 다 0 이면 memcpy(SR+0x1c0, +8, 0x50)
 * ```
 * A = side 1 = `LeagueMatchup.home`, B = `away` 다 (`matchupsOf` 와 같은 채움 순서).
 * 점수는 **명단 기준**이라 `simulateLeagueGame` 의 칸 점수와 엇갈린다(`cpuGameSidesOf`) — scoreA 가 칸 0(`awayRuns`)이다.
 * 경기 뒤 마무리 판(0xf1 그림 0xb400)이 이 표를 그린다.
 */
export interface LeagueDayBoard {
  /** +8 [5] — side 1(홈) 팀 */
  readonly teamsA: readonly number[]
  /** +0x1c [5] — side 0(원정) 팀 */
  readonly teamsB: readonly number[]
  /** +0x30 [5] — A 명단의 득점. 내 경기 줄은 −1 */
  readonly scoresA: readonly number[]
  /** +0x44 [5] — B 명단의 득점. 내 경기 줄은 −1 */
  readonly scoresB: readonly number[]
}

/** 하루치 경기가 남긴 것 — 순위표와 **선수 기록표** 두 벌이다 */
export interface LeagueDayResult {
  /** 0xc2a48 의 하루 대진·점수표 (`LeagueDayBoard`) — 시즌모드가 SR+0x1c0 에 옮겨 담는다 */
  readonly board: LeagueDayBoard
  readonly league: League
  readonly playerStats: LeaguePlayerStats
  /**
   * 팀 번호 → 투수 칸(0~7)별 스태미나 — 넘긴 표에 오늘 치른 CPU 끼리 경기의 소모를 먹인 것(안 치른 팀은 그대로,
   * 표에 없던 팀은 10000 에서 시작). 하루 끝 회복(`0xb617c` +20%)은 아직 안 건 값이다.
   */
  readonly pitcherStaminas: Readonly<Record<number, readonly number[]>>
  /**
   * 팀 번호 → 오늘 CPU 경기가 끝났을 때 팀 레코드 8번 칸(마투수)의 스태미나 (`LeagueGameScore.acePitcherStaminas`).
   * 그 팀의 다음 **사람 경기**가 8번 칸을 그대로 읽을 때 쓸 값이다 — 다음 CPU 경기는 10000 으로 다시 덮는다.
   */
  readonly acePitcherStaminas: Readonly<Record<number, number>>
  /**
   * 팀 번호 → 오늘 CPU 경기 준비 `0xc239c` 가 그 팀 레코드(0xb8680 → 모드 2 는 시즌 저장 `0x1f571`)에 넣은 마선수.
   * 빼는 `0xb512c` 는 시즌 0xdf · 0xe5 진입만 불러 경기 뒤에도 레코드에 남는다 (U-105 r154 — 시즌 `SeasonSave.recordAces`)
   */
  readonly recordAces: Readonly<Record<number, LeagueGameAces>>
}
