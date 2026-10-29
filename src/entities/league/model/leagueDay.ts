/**
 * 하루치 리그 경기 (binary.mod 0xc2a48) — 공개 이름 모음.
 * 원본은 팀 전력으로 점수를 뽑지 않는다 — 오늘의 다섯 대진을 짜고, 내 팀 경기만 빼고
 * 나머지를 **사람 경기와 같은 타석 엔진**으로 끝까지 돌린 뒤 최종 점수를 읽어 승패를 기록한다.
 *
 * **무승부가 없다.** 리그 구조체에 무승부 칸 자체가 없어서, 점수가 같으면 한쪽이 승으로 들어간다.
 *
 * 하위 폴더 (`leagueDay/`):
 *   - `schedule/` — 대진 0xd89cb · 홈/원정 0xb7844 · 칸과 명단의 엇갈림 0xc239c
 *   - `roster/` — 명단 칸 · 팀 레코드 선수 배열(트레이드, 0x1f570)
 *   - `ability/` — CPU 경기용 능력치 0xb570c(팀 능력치 정액 0xb592c · 투지 · 코치 0xb5a74)
 *   - `aces/` — 마선수(0xb8870 · 0xb88c8)와 준비 굴림 다섯(c2464~c24ea)
 *   - `game/` — 한 경기(두 명단 → 반 이닝 0xc262c → 승패세 0xa7de8 → 기록 모음)
 *   - `day/` — 하루치(0xc2a48)와 대진·점수표
 */
export const REGULAR_INNINGS = 9
/** 하루 대진 수 — 열 팀이 다섯 경기를 치른다 */
export const LEAGUE_DAY_GAME_COUNT = 5

export { cpuGameSidesOf, matchupsOf } from '@/entities/league/model/leagueDay/schedule/matchups'
export type { LeagueGameAces } from '@/entities/league/model/leagueDay/types/leagueGameExtras'
export { ACE_BATTER_ROSTER_SLOT, ACE_PITCHER_SLOT } from '@/entities/league/model/leagueDay/roster/slots'
export type { LeagueRecordPlayer, LeagueTeamRecord } from '@/entities/league/model/leagueDay/roster/teamRecord'
export type { LeagueAbilityContext } from '@/entities/league/model/leagueDay/ability/abilityContext'
export { cpuBatterGameAbilityOf, cpuPitcherGameAbilityOf } from '@/entities/league/model/leagueDay/ability/cpuGameAbility'
export { ACE_PITCHER_RECORD_STAMINA } from '@/entities/league/model/leagueDay/aces/acePlayers'
export { cpuGameAcesOf, rollCpuGamePrep } from '@/entities/league/model/leagueDay/aces/cpuGamePrep'
export { leagueFightingSpiritOf } from '@/entities/league/model/leagueDay/game/fightingSpirit'
export { decisionsAfterHalfInning } from '@/entities/league/model/leagueDay/game/decisions'
export { simulateLeagueGame } from '@/entities/league/model/leagueDay/game/simulateLeagueGame'
export { LEAGUE_DAY_NO_SCORE } from '@/entities/league/model/leagueDay/day/leagueDayBoard'
export { playLeagueDay } from '@/entities/league/model/leagueDay/day/playLeagueDay'
