import { BATTERS_PER_TEAM, PITCHERS_PER_TEAM } from '@/entities/team/model/teamRoster'

/** state 칸 — 초 공격 0 · 말 공격 1 */
export const AWAY_SIDE = 0
export const HOME_SIDE = 1

/**
 * 타순 칸 수. 팀 객체 `team+0xe..+0x16` 아홉 칸이 타순이고, 타석이 끝나면 `0xaf020` 이
 * `(team+0x32 + 1) mod 9` 로 다음 칸을 세운다 (E 3b 확정). 로스터 열두 명 중 뒤 셋은 벤치라
 * **타순에 서지 않는다** — 예전에는 커서를 12 로 나눠 벤치 셋까지 돌려 썼다(원본과 다름).
 */
export const BATTING_ORDER_SIZE = 9

/** 팀 투수 여덟 칸 (`team+0x0c`) — 벤치는 여기서 마운드와 이미 쓴 투수를 뺀 나머지다 */
export const ALL_PITCHER_SLOTS: readonly number[] = Array.from({ length: PITCHERS_PER_TEAM }, (_, slot) => slot)

/**
 * 명단 밖에서 들어온 **마타자**의 로스터 칸 표시 — 리그 붙박이 표(0~11)에 없는 선수다 (`0x1f84c` 저장 레코드).
 * 선수 기록표(`leaguePlayerStats`)에는 쌓지 않는다 (`simulateLeagueGame` 주석).
 */
export const ACE_BATTER_ROSTER_SLOT = BATTERS_PER_TEAM
/** **마투수**가 앉는 투수 명단 칸 — `0xb521c` 의 `0x60` 가지가 8번 칸(로스터 여덟 뒤)에 넣는다 */
export const ACE_PITCHER_SLOT = PITCHERS_PER_TEAM

/** 마타자를 넣는 명단 칸 — `0xb53f0` 의 `0x40` 가지가 9번 = 첫 벤치 칸 */
export const ACE_BATTER_ENTRY_SLOT = 9
