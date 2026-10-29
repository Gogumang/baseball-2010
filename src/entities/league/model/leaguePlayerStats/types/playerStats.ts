import type { LeagueBatterLine } from '@/entities/league/model/leaguePlayerStats/types/batterLine'
import type { LeaguePitcherLine } from '@/entities/league/model/leaguePlayerStats/types/pitcherLine'

/**
 * 시즌 단위로 사는 표. 새 시즌에 통째로 비운다 —
 * 원본 `0x204e0(저장, 편, 0)` 이 리그 전 선수의 시즌 성적을 0 으로 되돌린다
 * (`playerCareer.startNextSeason` 참고).
 *
 * 한 번도 타석에 서지 않은 선수는 칸이 아예 없다. 저장 용량을 아끼려는 것이 아니라,
 * 순위표가 어차피 **타수 ≤ 0 인 선수를 빼기** 때문이다 (0x9d789 의 첫 제외 조건).
 */
export interface LeaguePlayerStats {
  /** 타자 전역 번호 → 그 선수의 이번 시즌 성적 */
  readonly batters: Readonly<Record<number, LeagueBatterLine>>
  /**
   * 투수 전역 번호 → 그 투수의 이번 시즌 성적.
   *
   * ⚠️ **옛 저장에는 이 칸이 없다**(타자 네 칸만 쌓던 때의 저장). 그래서 읽는 쪽
   * (`leaguePitcherLineOf`·`recordLeaguePitcherAppearances`)이 `undefined` 를 견디게 해 두었다 —
   * 저장 형식 번호는 올리지 않는다(올리면 `load` 가 옛 저장을 통째로 버린다).
   */
  readonly pitchers?: Readonly<Record<number, LeaguePitcherLine>>
  /**
   * **붙박이 표 밖 선수**(시즌모드에 영입한 명전 0xb4~ · 나리 0xfe)의 이번 시즌 타자 줄 — 원본 id(+0) → 줄.
   *
   * 영입 0xc554 가 기록 0x30 바이트를 통째로 팀 레코드에 옮기고, 기록 함수 0xa8024 는 `0xa56dc(R, 선수, 0)` 이 참이면 그
   * 레코드 +0x20~ 에 쌓는다. 0xa56dc 의 모드 2 갈래(점프표 0xd8204[0] = 0xa56fa, 직접 떴다)는 시즌 객체 0x1f55d 의
   * +0x12c(국가대항전)·+0xb4(포스트시즌)가 0 이고 플래그 0 이면 선수가 마선수(0xb633d)가 아닐 때 참이다 — 명전·나리 선수는
   * 마선수 비트(+0xa 비트 6)가 없어 쌓인다. 순위표 0x9d789 도 마선수만 빼고 훑는다.
   * 그 선수들은 내 팀에만 있고(트레이드에서 거절된다) 명전 id 는 칸마다, 나리는 투수·타자 한 명씩이라 id 로 갈린다.
   * 옛 저장에는 없다 — 빈 표로 본다.
   */
  readonly recordBatters?: Readonly<Record<number, LeagueBatterLine>>
  /** 붙박이 표 밖 선수의 이번 시즌 투수 줄 — `recordBatters` 주석과 같다 */
  readonly recordPitchers?: Readonly<Record<number, LeaguePitcherLine>>
}

/**
 * ⚠️ 빈 표에는 `pitchers` 칸을 **두지 않는다** — 투수 줄이 생기기 전 저장과 **같은 모양**이라야
 * 옛 저장을 그대로 읽을 수 있다 (`shared/api/save/localStorageSaveGame.ts` 의 `normalizeCareer` 가
 * 타자편 저장을 `{ batters }` 로만 다시 짓는다). 읽는 쪽이 `undefined` 를 견딘다.
 */
export const EMPTY_LEAGUE_PLAYER_STATS: LeaguePlayerStats = { batters: {} }
