import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { TEAMS } from '@/shared/config/original/teams'
import type { SeasonAwards } from '@/entities/awards/model/seasonAwards'

/**
 * 이벤트 명령 **system 3·4** — 타이틀·MVP 발표 창 (이벤트 큐 0x8cf64 의 하위 종류 점프표 0xd4ee4, 확정).
 * 나만의리그 r_event 에서는 370 "누가 얼마나 잘했는지"(sub 3)와 375 "MVP 선발만 남았어"(sub 4)에만 나온다.
 * 두 함수 다 글을 이벤트 객체의 팝업 버퍼 `obj+0xba` 에 쓰고(0x1400408), 재생기가 알림 창으로 띄운다.
 */
export const SYSTEM_TITLE_WINDOW = 3
export const SYSTEM_MVP_WINDOW = 4

/** 0x8b3bc 의 첫 글 0xcc210 = "!C" (가운데 정렬) */
const CENTER = '!C'
/** 0xd4dac */
const NEW_LINE = '!N'
/** 0xd4da4 — 팀 이름과 선수 이름 사이 */
const SPACE = ' '
/** 0x8b23c 가 처음에 넣는 StrUSER_EVT[83] "!C[페넌트레이스 MVP]!N!N" */
const MVP_HEADER_USER_EVENT = 83
/** 내가 MVP 면 붙는 StrUSER_EVT[84] "축하합니다!!!N[페넌트레이스 MVP]!N로 선정되었습니다." */
const MVP_CONGRATULATION_USER_EVENT = 84
/** 대진 칸이 "없음" 인 팀 번호(0x8dad4 초기값) — 9 를 넘으면 그 칸을 건너뛴다 (0x8b462 `cmp r3,#9 ; bgt`) */
const LAST_LEAGUE_TEAM = 9

/** 팀 이름 표 `[0x1552cf8]` = StrCOMMON — 앞 15칸이 팀 이름이다 (`TEAMS` 와 같은 차례) */
const teamNameOf = (teamId: number) => TEAMS[teamId]?.name ?? ''
const userEventOf = (index: number) => ORIGINAL_USER_EVENTS[index] ?? ''

/**
 * 타이틀 발표 창 0x8b3bc — 130 이 0x8dad4 로 채운 타이틀 칸(+0x30c 팀 · +0x31c 이름)을 차례로 적는다.
 * ```
 * 글 = "!C"
 * 칸 i (0..3): 팀 ≤ 9 이고 문구 번호 ≠ 0 이면  USER_EVT[번호] + "!N" + 팀이름[팀] + " " + 이름 + "!N" + "!N"
 * 문구 번호 표 0xd4e30 = [76, 77, 78, 0] — 투수(+0x308 == 0xd)면 앞 셋 +3, 나만의리그 마무리면 첫째 +3 더 (세이브왕 82)
 * ```
 * 나만의리그는 넷째 번호가 0 이라 세 칸뿐이다. 웹 `TitleSlot.userEventIndex` 가 그 번호(마무리 82 포함)다.
 * 자격자가 없는 칸(팀 10)은 줄째 빠진다.
 */
export function titleWindowTextOf(awards: SeasonAwards): string {
  return awards.titles.reduce((text, slot) => {
    if (slot.teamId > LAST_LEAGUE_TEAM || slot.userEventIndex === 0) return text
    return (
      text + userEventOf(slot.userEventIndex) + NEW_LINE + teamNameOf(slot.teamId) + SPACE + slot.winnerName + NEW_LINE + NEW_LINE
    )
  }, CENTER)
}

/**
 * MVP 발표 창 0x8b23c — 131 의 0x8dd60 이 남긴 MVP 칸(+0x370 팀 · +0x374 이름 · +0x388 내가 MVP 인가)을 적는다.
 * ```
 * 글 = USER_EVT[83] + 팀이름[+0x370] + " " + (+0x374) + "!N" + "!N"
 * 나만의리그(0x7b999 거짓)이고 +0x388 이면  + USER_EVT[84] + "!N"
 * ```
 * MVP 칸은 0x8dd60 이 채운다 — `SeasonAwards.mostValuablePlayer`(내가 MVP 면 나, 아니면 내가 못 딴 첫 타이틀 칸 그대로).
 * 이 창은 팀 번호가 9 를 넘어도 거르지 않아, 자격자 없는 칸이 뽑히면 팀 10 이름이 그대로 찍힌다 — 원본 그대로.
 */
export function mvpWindowTextOf(awards: SeasonAwards): string {
  const shown = awards.mostValuablePlayer
  const header = userEventOf(MVP_HEADER_USER_EVENT) + teamNameOf(shown.teamId) + SPACE + shown.name + NEW_LINE + NEW_LINE
  return awards.isMostValuablePlayer ? header + userEventOf(MVP_CONGRATULATION_USER_EVENT) + NEW_LINE : header
}

/**
 * 재생기에 넘기는 창 글 — system 3·4 가 아니면 null(예전처럼 지나간다).
 * 시상 판정은 무거워서 창을 띄울 때만 부른다 (`awardsOf`).
 */
export function awardWindowTextOf(sub: number, awardsOf: () => SeasonAwards): string | null {
  if (sub === SYSTEM_TITLE_WINDOW) return titleWindowTextOf(awardsOf())
  if (sub === SYSTEM_MVP_WINDOW) return mvpWindowTextOf(awardsOf())
  return null
}
