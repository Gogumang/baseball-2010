import { LEAGUE_SIDE_HOME, leagueSideOf, postseasonSideOf } from '@/entities/league/model/league'
import type { PostseasonSeries } from '@/entities/league/model/league'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import type { PlayerSide } from '@/entities/game/model/gameState'

/**
 * 나만의리그 경기 준비 **0x1c46c** 가 커리어에서 읽는 두 값 — 타자편(모드 4)·투수편(모드 3) 공용.
 *
 * 0x1c46c 는 장면 0x106 의 함수라 두 편이 함께 쓴다 (모드 갈림 없음):
 * ```
 * 1c4dc: 내 팀 = (s8)S[1] ; 상대 = 0xb765c(L, 내 팀)
 * 1c4f0: [sp+0x3c] = 0xb7844(L, 내 팀)      ; 내 side — 정규시즌·포스트시즌 가리지 않고 늘 부른다
 * 1c4fe: r5        = 0xb7844(L, 상대)
 * 1c576: g = (s8)S+0xb2 (= L+0x32) ; g ≠ 0 이면 두 팀 로테이션 0xb8c80
 * ```
 * 장면 0x39fdc 의 모드 3·4 가지(0x3a164 → 0x3a228)가 같은 side 로 `경기[0x28+side]` 에 팀을 앉힌다 (S11).
 */
export interface LeagueGameFields {
  readonly teamId: number
  /** 이번 시즌에 치른 내 경기 수 — 정규시즌에는 곧 L+0x32 다 */
  readonly gamesPlayed: number
  readonly postseason: PostseasonSeries | null
}

/**
 * 날짜 카운터 **g = L+0x32** (S+0xb2).
 *
 * - 정규시즌: 하루 끝 0xb818c 가 +1(b819a) — 오늘까지 치른 경기 수다.
 * - 포스트시즌: 대진 0xb80a8 이 0(b811c), 시리즈 끝 0xb7724 가 −1(b777a), 하루 끝이 +1 — CPU 끼리 경기(0xc2760 →
 *   0xb818c)도 올리지만 시리즈가 바뀌면 다시 0 부터라 **그 시리즈에서 치른 경기 수**(무승부가 없어 두 팀 승수 합)다.
 *   한국시리즈가 끝나면 0xb7724 가 −1 로 두고 하루 끝이 0 으로 올린다 — 대회가 끝난 대진은 0 이다.
 */
export function leagueDayCounterOf(career: LeagueGameFields): number {
  const series = career.postseason
  if (series === null) return career.gamesPlayed
  if (series.round === '종료') return 0
  return series.wins[0] + series.wins[1]
}

/**
 * 내 팀이 앉는 측 — `0xb7844(L, 내 팀)` (S11 2절, 확정).
 *
 * - 포스트시즌(L+0x34 ≠ 0): 대진 칸 1(아랫 시드)이면 0(원정·선공), 아니면 1(홈·후공) — `postseasonSideOf` 와 같다.
 * - 정규시즌: 일정표 0xd89cb · 9일 주기 뒤집기 · g > 22 한 번 더 뒤집기 — `leagueSideOf(g, 팀)` (R1 1절).
 *   정규시즌 g 는 치른 경기 수라 `gamesPlayed` 를 그대로 넘긴다.
 *
 * 원본 side 1 = 홈(말 공격) → 웹 `PLAYER_SIDE_LAST_BAT`, side 0 = 원정 → `PLAYER_SIDE_FIRST_BAT`.
 */
export function leagueGamePlayerSideOf(career: LeagueGameFields): PlayerSide {
  const series = career.postseason
  const side = series === null ? leagueSideOf(career.gamesPlayed, career.teamId) : postseasonSideOf(series, career.teamId)
  return side === LEAGUE_SIDE_HOME ? PLAYER_SIDE_LAST_BAT : PLAYER_SIDE_FIRST_BAT
}
