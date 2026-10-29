import type { LeagueRecord } from '@/entities/awards/model/leaderboard'
import { achievedGoalCountForMvp } from '@/entities/awards/model/seasonAwards/mvp/mvpGoals'
import type { PlayerCareer } from '@/entities/awards/model/seasonAwards/otherSlices'
import { judgeTitles, NO_TEAM, type TitleSlot } from '@/entities/awards/model/seasonAwards/titles/judgeTitles'
import type { AwardRole } from '@/entities/awards/model/seasonAwards/titles/titleSpecs'

/** MVP 조건의 목표 달성 수 기준 — 원본은 `cmp r0,#3; ble` 라 **4 이상**이어야 한다 */
export const MVP_GOAL_COUNT = 4

/** 시즌 MVP 발표에 쓰는 사람 */
export interface AwardWinner {
  readonly teamId: number
  readonly name: string
}

export interface SeasonAwards {
  /** 타이틀 세 칸 (발표 순서 그대로) */
  readonly titles: readonly TitleSlot[]
  /** 내가 딴 타이틀 수 (0~3) */
  readonly wonCount: number
  /** 내가 시즌 MVP 인가 (이벤트 객체 +0x388) */
  readonly isMostValuablePlayer: boolean
  /**
   * 발표할 MVP 칸(+0x370 팀 · +0x374 이름) — 내가 MVP 면 나, 아니면 **내가 못 딴 첫 타이틀 칸**의 팀·이름 그대로다
   * (0x8df18 — 이름이 비었는지 안 본다. 자격자 없는 칸이면 팀 10 · 빈 이름). 그런 칸이 없으면 처음 값 팀 10 · 빈 이름.
   */
  readonly mostValuablePlayer: AwardWinner
}

/** 0x8dd60 이 MVP 칸을 처음 채우는 값 — 팀 10(0x8dd78) · 빈 이름(0x8dd84) */
const NO_MOST_VALUABLE_PLAYER: AwardWinner = { teamId: NO_TEAM, name: '' }
/** 0x8de58(`tst +0x36c, #0xffffff`)·0x8df18(i ≤ 2) 이 보는 타이틀 칸 수 — 나리는 세 칸이다 */
const MVP_TITLE_SLOT_COUNT = 3

/**
 * 시상을 받는 **내 육성 선수** — 타자편·투수편이 함께 쓰는 꼴이다.
 * (원본은 한 벌의 육성 코드가 모드 3·4 를 같이 돌리므로 0x8dd60 도 하나뿐이다.)
 */
export interface AwardSubject {
  readonly teamId: number
  readonly name: string
  /** 올해의 목표 달성 수 — **단계 2**(MVP 판정용, 0xa3de8 인자 2) */
  readonly achievedGoalCount: number
}

/**
 * 시상 한 번 (0x8dad4 → 0x8dd60) — 모드를 가리지 않는 알맹이다.
 *
 * MVP = **(타이틀 ≥ 1) AND (타이틀 3개 모두 OR 올해의 목표(단계 2) 달성 4개 이상)** — B-3 확정.
 * 0x8de58 이 세 칸을 한 번에 보고 모두 0 이면 바로 탈락시키므로, 목표를 다 채워도
 * **타이틀이 하나도 없으면 MVP 가 아니다**.
 */
export function judgeAwards(subject: AwardSubject, records: readonly LeagueRecord[], role: AwardRole = '타자'): SeasonAwards {
  const titles = judgeTitles(records, role)
  const wonCount = titles.filter((title) => title.isMine).length
  const isMostValuablePlayer = wonCount >= 1 && (wonCount === titles.length || subject.achievedGoalCount >= MVP_GOAL_COUNT)

  if (isMostValuablePlayer) {
    return {
      titles,
      wonCount,
      isMostValuablePlayer,
      mostValuablePlayer: { teamId: subject.teamId, name: subject.name },
    }
  }
  // MVP 가 아니면 +0x36c[i] == 0 인 **첫** 칸(i = 0..2)의 팀(+0x30c[i])·이름(+0x31c + 0x14·i)을 그대로 옮긴다
  // (0x8df18 → 0x8dee6). 이름이 비었는지·팀이 10 인지는 보지 않는다.
  // 세 칸이 모두 내 것인데 MVP 가 아닌 갈래(0x8df32~, 다른 순위표를 다시 세운다)는 **도달할 수 없다**(r126 확정):
  // 0x8df18 로 오는 길은 0x8de5e(세 칸 모두 0)와 0x8de8c(세 칸 중 0 이 있고 목표 ≤ 3) 둘뿐(0x8dd60~ 전수)이라
  // 0x8df20 고리가 늘 0 인 칸을 찾아 0x8dee6 으로 빠진다 — 세 칸이 다 서 있으면 0x8de78 에서 이미 MVP 다.
  // 그래서 아래 `shown` 이 없는 경우도 생기지 않는다(남겨 둔 처음 값은 안전장치일 뿐).
  const shown = titles.slice(0, MVP_TITLE_SLOT_COUNT).find((title) => !title.isMine)
  return {
    titles,
    wonCount,
    isMostValuablePlayer,
    mostValuablePlayer: shown ? { teamId: shown.teamId, name: shown.winnerName } : NO_MOST_VALUABLE_PLAYER,
  }
}

/** 타자편(모드 4) 입구 — 커리어에서 목표 달성 수를 세어 `judgeAwards` 에 넘긴다 */
export function judgeSeasonAwards(career: PlayerCareer, records: readonly LeagueRecord[], role: AwardRole = '타자'): SeasonAwards {
  return judgeAwards({ teamId: career.teamId, name: career.name, achievedGoalCount: achievedGoalCountForMvp(career) }, records, role)
}
