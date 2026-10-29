import { leaderOf, type LeaderKind, type LeagueRecord } from '@/entities/awards/model/leaderboard'
import { TITLE_SPECS, TITLE_USER_EVENT_INDEX, type AwardRole, type TitleName } from '@/entities/awards/model/seasonAwards/titles/titleSpecs'

/** 원본이 이벤트 객체에 들고 있는 타이틀 칸 하나 (+0x30c 팀 · +0x31c 이름 · +0x36c 내 것인가) */
export interface TitleSlot {
  readonly name: TitleName
  readonly kind: LeaderKind
  /** StrUSER_EVT 번호 */
  readonly userEventIndex: number
  /** 1위 팀 번호. 자격자가 없으면 **10** — 원본이 "없음" 으로 채워 두는 값이다 (0x8dad4) */
  readonly teamId: number
  /** 1위 선수 이름. 없으면 빈 문자열 */
  readonly winnerName: string
  /** 1위가 내 선수인가 (+0x36c[i]) = 수상 */
  readonly isMine: boolean
}

/** 수상자가 없을 때 채우는 팀 번호 — 원본 0x8dad4 가 칸을 10 으로 초기화한다 */
export const NO_TEAM = 10

/** 개인 타이틀 (0x8dad4) — 나리는 세 칸, 시즌모드 투수는 네 칸이다. 순위표 1위를 그대로 옮겨 적는다 */
export function judgeTitles(records: readonly LeagueRecord[], role: AwardRole = '타자'): readonly TitleSlot[] {
  return TITLE_SPECS[role].map((spec) => {
    const leader = leaderOf(records, spec.kind)
    return {
      name: spec.name,
      kind: spec.kind,
      userEventIndex: TITLE_USER_EVENT_INDEX[spec.name],
      teamId: leader?.record.teamId ?? NO_TEAM,
      winnerName: leader?.record.name ?? '',
      isMine: leader?.record.isMine ?? false,
    }
  })
}
