/** 투수 칸 — 레코드 +0xc 부터 s16 네 칸 */
export const PITCHER_SLOT = { 제구: 0, 구속: 1, 변화: 2, 체력: 3 } as const
/** 타자 칸 */
export const BATTER_SLOT = { 히트: 0, 파워: 1, 수비: 2, 주루: 3 } as const
/** 팀 능력치 칸 — 팀 레코드 +4·+6·+8·+0xa (XlsTEAM_DATA 열 2~5) */
export const TEAM_ABILITY_SLOT = { 투구: 0, 타격: 1, 집중: 2, 근성: 3 } as const

/** 원본 게임 모드 (0x1552d10) 중 팀 경기인 것 */
export const TEAM_GAME_MODE = { 일반: 1, 시즌: 2, 대전: 8, 대전이벤트: 9 } as const

/** 능력치 상한 — 0xb5b06 이 0..999 로 자른다 */
export const ABILITY_LIMIT = 999
