import { PLAYER_OWN_BIT, withSlot } from '@/entities/season-mode/model/playerRecruit/playerRecord'
import { insertBatter, insertPitcher, RECRUIT_PITCHER_STAMINA } from '@/entities/season-mode/model/playerRecruit/insert'
import type { SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit/seasonPlayer'

export type RecruitSourceKind = '나리투수' | '나리타자' | '명예투수' | '명예타자'

/**
 * 영입 화면의 커서 칸 k → 원본 기록 (R13 9절 확정, `0xc4ea`).
 * 칸 배치는 **`0 = 나리 투수, 1~4 = 명예 투수, 5 = 나리 타자, 6~ = 명예 타자`** 다.
 * 쪽(투수/타자)은 `k > 4` 로 가른다.
 */
export function recruitSourceOf(cursor: number): RecruitSourceKind {
  if (cursor === 0) return '나리투수'
  if (cursor <= 4) return '명예투수'
  if (cursor === 5) return '나리타자'
  return '명예타자'
}

/** 영입한 선수가 투수 쪽인가 — 원본은 `[sp] = (k > 4) ? 1(타자) : 0(투수)` 로 가른다 */
export function recruitsPitcher(cursor: number): boolean {
  return cursor <= 4
}

/**
 * 중복 검사 `0xb5054(팀, 쪽)` — 나리 선수는 팀에 **한 명씩만**.
 * 판정은 `+0xa < 0`(부호 있는 읽기 = bit7 = 육성/명전 표시)이다.
 * 걸리면 StrMODE[181] "이미 영입된 선수 입니다".
 */
export function hasRecruitedCareerPlayer(players: readonly SeasonPlayer[]): boolean {
  return players.some((player) => (player.kindByte & PLAYER_OWN_BIT) !== 0)
}

/** 중복 검사 `0xb50ac(팀, 쪽, i)` — 같은 명예의전당 선수 번호가 이미 있는가 */
export function hasRecruitedHallOfFamePlayer(players: readonly SeasonPlayer[], id: number): boolean {
  return players.some((player) => player.id === id)
}

export type RecruitRefusal = '이미영입'

export interface RecruitResult {
  readonly roster: SeasonTeamRoster
  /**
   * 고쳐진 **원본 기록**. 원본은 `0xb6604` 로 저장된 나리·명예 레코드의 칸 번호를
   * 실제로 바꿔 놓는다 — 부작용을 숨기지 않으려고 돌려준다.
   */
  readonly source: SeasonPlayer
}

/**
 * 영입 확정 — `0xc554~0xc5cc`.
 * ```
 * 선수 = 0xb6604(원본, 자리)                       ; 원본 레코드의 칸 번호를 자리로
 * 투수: 선수+0x2c = 0x2710 ; 0xb6cc4(선수) ; 0xb521c(팀, 선수, 0)
 * 타자: 0xb8e28(선수)                    ; 0xb53f0(팀, 선수, 0)
 * ```
 * **비용도 인기도 조건도 없다.** 통과하면 StrMODE[180] "선수 영입을 완료하였습니다".
 *
 * (`0xb6cc4`·`0xb8e28` 이 원본 레코드의 무엇을 더 만지는지는 해독되지 않았다 — 여기서는
 * 스태미나만 채운다. 값을 지어내지 않으려고 나머지는 건드리지 않았다.)
 *
 * **자리 `slot` 은 팀 레코드 배열의 칸 차례**다 (직접 떴다): 0xc554 가 자리 목록 객체 `[this+0xa8]+0x41c` 의 커서
 * (`+0xc + +0x10 × +0x14`)를 `0xb6605` 로 +0xa 하위 5비트에 적고, 끼워넣기 0xb521c 는 그 5비트(`0xb6395` · 나리는
 * `0xb6721(P, 0x80)` 의 같은 5비트)를 다시 읽어 `0xb51fc(T, k)` — **레코드 칸 k** — 에 넣는다. 투수 레코드 배열은 경기
 * 준비마다 로테이션 0xb5ca8 로 섞인 차례라 웹 명단(로테이션 전 자리 차례) 첨자와 다를 수 있다 — 그 첨자를
 * `rosterIndex` 로 따로 받는다(없으면 `slot`, 타자는 섞이지 않아 늘 같다). 밀려난 선수는 레코드 맨 끝 = 명단 맨 끝이다.
 */
export function recruitPlayer(
  roster: SeasonTeamRoster,
  source: SeasonPlayer,
  asPitcher: boolean,
  slot: number,
  rosterIndex: number = slot,
): RecruitResult {
  const renumbered = withSlot(source, slot)
  if (asPitcher) {
    const player = { ...renumbered, stamina: RECRUIT_PITCHER_STAMINA }
    return {
      roster: { ...roster, pitchers: insertPitcher(roster.pitchers, player, rosterIndex) },
      source: player,
    }
  }
  return {
    roster: { ...roster, batters: insertBatter(roster.batters, renumbered, rosterIndex) },
    source: renumbered,
  }
}
