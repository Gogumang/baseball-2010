import { LEADER_KIND, type LeaderKind } from '@/entities/awards/model/leaderboard'

/** 시상 문구 StrUSER_EVT 번호 (표 0xd4e30) */
export const TITLE_USER_EVENT_INDEX = {
  홈런왕: 76,
  타점왕: 77,
  타율왕: 78,
  다승왕: 79,
  삼진왕: 80,
  방어왕: 81,
  세이브왕: 82,
} as const

export type TitleName = keyof typeof TITLE_USER_EVENT_INDEX

/**
 * 내 선수가 타자인지 투수인지 — 원본 모드 3(나만의리그 투수)·4(나만의리그 타자).
 *
 * `시즌투수` 는 **시즌모드(모드 2)** 전용이다. 나만의리그와 칸 수가 다르다 — 아래 표 주석 참고.
 */
export type AwardRole = '타자' | '투수' | '마무리' | '시즌투수'

export interface TitleSpec {
  readonly name: TitleName
  readonly kind: LeaderKind
}

/**
 * 타자 종류 표 0xd4f18 = `[9, 11, 12]` → 홈런왕·타점왕·타율왕.
 * 투수 종류 표 0xd4f24 = `[1, 6, 4, 13]` → 다승왕·삼진왕·방어왕 (13 은 `cmp #0xd` 로 건너뛴다).
 * 나만의리그 투수가 **마무리**(0xb6ded == 2)면 첫째가 3(세이브)로 바뀌어 세이브왕이 된다.
 *
 * ⚠️ **시즌모드는 넷째가 3(세이브, 문자열 82)** 이라 투수 타이틀이 **네 칸**이다 (B 4절 2번).
 * 나만의리그(세 칸)와 섞지 말 것 — MVP 판정이 읽는 칸도 나리는 셋(+0x36c~0x36e)이다.
 */
export const TITLE_SPECS: Readonly<Record<AwardRole, readonly TitleSpec[]>> = {
  타자: [
    { name: '홈런왕', kind: LEADER_KIND.홈런 },
    { name: '타점왕', kind: LEADER_KIND.타점 },
    { name: '타율왕', kind: LEADER_KIND.타율 },
  ],
  투수: [
    { name: '다승왕', kind: LEADER_KIND.승 },
    { name: '삼진왕', kind: LEADER_KIND.탈삼진 },
    { name: '방어왕', kind: LEADER_KIND.방어율 },
  ],
  마무리: [
    { name: '세이브왕', kind: LEADER_KIND.세이브 },
    { name: '삼진왕', kind: LEADER_KIND.탈삼진 },
    { name: '방어왕', kind: LEADER_KIND.방어율 },
  ],
  시즌투수: [
    { name: '다승왕', kind: LEADER_KIND.승 },
    { name: '삼진왕', kind: LEADER_KIND.탈삼진 },
    { name: '방어왕', kind: LEADER_KIND.방어율 },
    { name: '세이브왕', kind: LEADER_KIND.세이브 },
  ],
}
