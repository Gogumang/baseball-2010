import type { LeagueAbilityContext } from '@/entities/league/model/leagueDay/ability/abilityContext'
import type { LeagueTeamRecord } from '@/entities/league/model/leagueDay/roster/teamRecord'

/** 한 팀이 받는 마선수 번호 둘 (`ACE_BATTERS` · `ACE_PITCHERS` 칸 0~4) */
export interface LeagueGameAces {
  readonly batter: number
  readonly pitcher: number
}

/** `simulateLeagueGame` 의 덧붙임 — 경기 준비가 넣는 것 */
export interface LeagueGameExtras {
  /** 명단(`matchup` 의 away·home)마다 넣을 마선수 — `0xb8870`(마타자)·`0xb88c8`(마투수) */
  readonly aces?: { readonly away?: LeagueGameAces; readonly home?: LeagueGameAces }
  /**
   * 마선수 레벨 열 칸 `mgr[0x13a..0x143]` — 마선수 능력치 네 칸이 `0xb6414` 첫 단계에서 `v · 0xd88aa[레벨] / 100`
   * 을 먹는다(모드를 가리지 않는 전역 칸). 안 넘기면 모두 Lv1(60%) — 새 저장 기본값이다.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  /**
   * 두 명단이 **같은 팀 레코드 하나**를 쓴다 — 국가대항전 CPU 경기(`0xc2c4c`)는 대회 중 `0x1f570` 이 팀 10 이 아닌 팀을
   * 모두 상대국 슬롯 `+0x934` 하나로 돌려 두 팀 객체가 같은 선수 레코드를 읽는다. 투수 스태미나 `+0x2c` 가 레코드에
   * 있으므로 **한 표를 두 팀이 같이 깎는다** — 같은 투수가 양쪽 마운드에 서면 한 값을 나눠 쓴다.
   * 팀 객체의 명단 차례(`team[i]`)·교체로 쓴 칸은 팀마다 따로다.
   */
  readonly sharedRoster?: boolean
  /**
   * 명단마다의 **투수 레코드 차례** (`League.pitcherOrders`) — 칸 p 에 앉은 붙박이 표 칸. 0번이 선발이고 나머지가
   * 벤치 차례다(교체 0xabfcc 가 `team+0x0c` 를 이 차례로 훑는다 — 같은 조건이면 앞 칸을 고른다). 안 넘기면 `[0..7]`.
   */
  readonly pitcherOrders?: { readonly away?: readonly number[]; readonly home?: readonly number[] }
  /** 경기용 능력치(0xb570c)의 모드 갈래 — 교체 0xabfcc 마무리 갈래의 능력 합 0xb5b50 에 쓴다. 안 넘기면 모드 2 밖 */
  readonly abilityContext?: LeagueAbilityContext
  /**
   * 명단마다의 **팀 레코드 선수 배열** (`LeagueTeamRecord`) — 트레이드로 바뀐 팀만 넘긴다. 안 넘긴 명단은 붙박이 표 그대로
   * (칸 k = 표 칸 k)다. 투수 차례(`pitcherOrders`)·스태미나 표의 칸은 이 배열의 첨자다.
   */
  readonly records?: { readonly away?: LeagueTeamRecord; readonly home?: LeagueTeamRecord }
}
