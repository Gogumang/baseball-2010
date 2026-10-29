import { TITLE_NAMES } from '@/entities/career/model/titles/names'

/** 칭호 8 "국가 대표" (StrNICKNAME[72] "국가대표 첫 선발") */
const NATIONAL_TEAM_TITLE = 8

/**
 * 국가대항전 순위 화면(나리 상태 134)의 틀 `0x1b92c` 머리 (0x1b92e~0x1b958):
 * ```
 * if 장면+0x2c(이 상태에 들어와 돈 틀 수) == 1 && !0xa4089(선수, 8):  장면+0x270 = 8 ; 0x1274c(칭호 팝업)
 * ```
 * 장면+0x2c 는 상태가 바뀔 때 0xbc9c8 이 0 으로 두는 **틀 수**라(R9 61행) 순위 화면에 **들어올 때마다 한 번** 본다.
 * 비트 검사만 있으니 처음 들어온 날 한 번 주는 셈이다 — 타자편·투수편이 같은 장면(0x106)·같은 비트다.
 * 순위 화면에 들어올 때 부르면 줄 칭호 이름을, 이미 가졌으면 null 을 돌려준다.
 */
export function nationalCupStandingsTitleOf(owned: readonly string[]): string | null {
  const title = TITLE_NAMES[NATIONAL_TEAM_TITLE]
  return owned.includes(title) ? null : title
}

/** 칭호 39 다이너마이트 배트 (0x27) */
const DYNAMITE_BAT_TITLE = 39
/** 116 의 문턱 — 이 경기 홈런 `S+0x1db` > 3 */
const DYNAMITE_BAT_HOME_RUNS = 3

/**
 * **116 경기 뒤 평가 진입의 칭호 39** (0x1278c 모드 4 갈래 1299e~129c8, 직접 떴다):
 * ```
 * 1299e: if !0xa4089(S, 0x27) && u8 S+0x1d8[3](이 경기 홈런) > 3:  장면+0x270 = 0x27 ; 0x1274c(칭호 팝업 0x78)
 * ```
 * 판정 0x1a1c0 에는 39 가 없다 — 관리 화면이 아니라 116 이 한 경기 홈런 4개 이상으로 준다. 타자편만(모드 4 갈래). 이어하기로
 * 116 을 다시 띄우면 비트를 다시 보므로 이미 받았으면 안 준다. 줄 칭호 이름 · 없으면 null.
 */
export function gameResultTitleOf(owned: readonly string[], homeRunsInGame: number): string | null {
  if (homeRunsInGame <= DYNAMITE_BAT_HOME_RUNS) return null
  const title = TITLE_NAMES[DYNAMITE_BAT_TITLE]
  return title === undefined || owned.includes(title) ? null : title
}
