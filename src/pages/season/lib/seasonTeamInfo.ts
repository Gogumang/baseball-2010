import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { coachNameOf } from '@/entities/season-mode/model/seasonCoach'
import { STAND_CAPACITY_TABLE } from '@/entities/season-mode/model/stadiumItems'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'

/**
 * **구단정보** (장면 0x105 상태 **0xd5**, 시즌정보 0xcd 칸 0) — 직접 떴다.
 *
 * ```
 * 0x53f8 → 0x5324 (들어옴)  gfx+0x24 = (s8)SR[1] 내 팀 · gfx+0x154 = 0x1f570(저장, 내 팀) 팀 레코드
 *                           gfx+0x140 = this+0xe0 = 0x6fd9c(0xcc14c, 내 팀, 1)   ; 팀 로고 그림 (team_logo)
 *                           0x76705([this+0xc4], 0x67, 0x38, 0)
 * 0x4884 (키)               취소(−16) → 0xcd. 그 밖은 아무것도 안 한다
 * 0xae68 (그림)             0x7ba44(gfx) 카드 · 0x7c450(gfx) 정보 칸 · 0x7f4ec 머리띠
 *                           (공통 앞그림 0xb810 기본 갈래 0x7f53c(hdr, 10, 5, 0) — 제목 10 "시즌모드" · 바닥 5 되돌아가기)
 * ```
 *
 * **카드 0x7ba44** (gfx+0x20 == 2 시즌, gfx+0x174 == 0xd5): mode_ui 프레임 0 의 박스 안에 로고 [gfx+0x140] 을
 * (W/2 − w/2 − 0x3e, H/2 − h/2 − 0x32) 에 · 팀 이름 img_text[0x41 + 팀] · ABILITY(img_text 159) 뒤
 * 0x7beda 가 상태 0xd9(또는 창 종류 3)가 아니라 0x7bf9c 로 가 **팀 도형** `0x5aefc(skin, …, 종류 0, 팀레코드, 0, 30)` —
 * 종류 0 은 팀 레코드 +4 · +6 · +8 · +0xa 네 값을 그대로 꼭짓점으로 쓴다(0x5b062~0x5b08c, 팀 고르기 도형과 같은 식).
 *
 * **정보 칸 0x7c450** (시즌 · 상태 ≠ 0xd9): 판은 mode_ui **프레임 3**(0x7c484 `[[obj+0xc]+8]+0xc`), 줄 7(0x7c548),
 * 이름표 img_text 는 표 **0xd48a8** `[394 단장, 222 코치, 191 좌석, 80 구장, 321 타입, 224 우승, 47 순위]` —
 * 줄 0~3 은 박스 1·2(왼쪽 열), 줄 4 부터 박스 3·4(오른쪽 열, 0x7c592 `cmp r5,#4`), 줄마다 y += h + 2.
 * 값(0x7c6d4~0x7cf26, 시즌 · 0xd9 아닌 갈래):
 * ```
 * 0 단장  SR+0x17c 글 (gfx+0x28 == 0 일 때) — 0xba410 가운데
 * 1 코치  c = (s8)SR+0x185 ≥ 0 ? StrCOMMON[c + 15] : "----"(0xd4bb0)
 * 2 좌석  0xd44f4[(s8)SR+0x1b8] × 1000 숫자(0xba719) 뒤 img_text 345 "석"
 * 3 구장  StrITEM[126 + SR+0x1b8] + " / " + StrITEM[133 + SR+0x1b9] + " / " + StrITEM[140 + SR+0x1ba]
 *         — 값 칸 너비를 w × 2 − 14 로 넓혀 흐르는 글 0x5a8c8 로
 * 4 타입  팀 레코드 +4·+6·+8·+0xa 를 이름표 0xd48b8 [263 투구, 347 타격, 204 집중, 205 근성] 과 함께 큰 값부터
 *         고르기 정렬(a[i] < a[j] 일 때만 바꾼다 — 같으면 앞 칸이 남는다) → 맨 앞 이름표 img_text
 * 5 우승  (s8)SR+0x7a(정규시즌 1위 횟수) == 0 ? "--"(0xd2160) : 숫자
 * 6 순위  (s8)SR+0xb2(이번 시즌 경기 수) == 0 ? "--" : 0xb7aa1(SR+0x80, 내 팀, 0) + 1
 * ```
 */

/** 이름표 img_text — 표 0xd48a8 */
export const TEAM_INFO_LABEL_FRAMES = [394, 222, 191, 80, 321, 224, 47] as const
/** 타입 이름표 img_text — 표 0xd48b8 (팀 레코드 +4 · +6 · +8 · +0xa 차례) */
export const TEAM_TYPE_FRAMES = [263, 347, 204, 205] as const
/** 좌석 숫자 뒤 img_text 345 "석" (0x7c926 `[img_text]+0x564`) */
export const SEAT_SUFFIX_FRAME = 345
/** 정보 칸 앞 네 줄이 왼쪽 열 — 줄 4 부터 오른쪽 열 (0x7c592) */
export const TEAM_INFO_LEFT_ROWS = 4
/** 팀 이름 img_text = 0x41 + 팀 (0x7bc96) */
export const TEAM_NAME_FRAME_BASE = 0x41

/** 코치 이름 StrCOMMON[c + 15] 이 없을 때 (0xd4bb0) */
const NO_COACH_TEXT = '----'
/** 우승·순위가 없을 때 (0xd2160) */
const NO_VALUE_TEXT = '--'
/** 구장 줄 사이 글 (0xcc298) */
const STADIUM_SEPARATOR = ' / '
/** StrITEM 구장 이름 첫 칸 — 관중석 126 · 전광판 133 · 잔디 140 (0x7ca02 `+0x7e` · `+0x85` · `+0x8c`) */
const STADIUM_NAME_BASES = [126, 133, 140] as const

export type TeamInfoValue =
  | { readonly kind: '글'; readonly text: string }
  /** 숫자 + img_text 꼬리 (좌석 "석") */
  | { readonly kind: '숫자'; readonly value: number; readonly suffixFrame?: number }
  /** img_text 한 장 (타입) */
  | { readonly kind: '그림'; readonly frame: number }
  /** 흐르는 글 0x5a8c8 — 값 칸이 w × 2 − 14 로 넓다 */
  | { readonly kind: '흐르는글'; readonly text: string }

export interface TeamInfoRow {
  readonly labelFrame: number
  readonly value: TeamInfoValue
}

export interface SeasonTeamInfoInput {
  readonly record: Pick<SeasonRecord, 'name' | 'coach' | 'stadiumEquipped' | 'regularSeasonFirsts' | 'games'>
  /** 내 팀 레코드 +4 · +6 · +8 · +0xa */
  readonly teamAbilities: readonly number[]
  /** `0xb7aa1(SR+0x80, 내 팀, 0)` — 0부터 */
  readonly rank: number
}

/** 타입 — 큰 값부터 고르기 정렬 뒤 맨 앞 (0x7cc5e~0x7cc9c). 같은 값이면 앞 칸이 이긴다 */
export function teamTypeFrameOf(abilities: readonly number[]): number {
  const values = [0, 1, 2, 3].map((index) => abilities[index] ?? 0)
  const frames: number[] = [...TEAM_TYPE_FRAMES]
  for (let i = 0; i <= 2; i += 1) {
    for (let j = i + 1; j <= 3; j += 1) {
      if (values[i] < values[j]) {
        ;[values[i], values[j]] = [values[j], values[i]]
        ;[frames[i], frames[j]] = [frames[j], frames[i]]
      }
    }
  }
  return frames[0]
}

/** 구장 줄 — 관중석 / 전광판 / 잔디 이름 */
export function stadiumLineOf(equipped: readonly number[]): string {
  return STADIUM_NAME_BASES.map((base, kind) => ORIGINAL_ITEMS[base + (equipped[kind] ?? 0)] ?? '').join(STADIUM_SEPARATOR)
}

/** 정보 칸 일곱 줄 (0x7c450 시즌 · 0xd5) */
export function seasonTeamInfoRowsOf({ record, teamAbilities, rank }: SeasonTeamInfoInput): readonly TeamInfoRow[] {
  const values: readonly TeamInfoValue[] = [
    { kind: '글', text: record.name },
    { kind: '글', text: record.coach >= 0 ? coachNameOf(record.coach) : NO_COACH_TEXT },
    { kind: '숫자', value: (STAND_CAPACITY_TABLE[record.stadiumEquipped[0] ?? 0] ?? 0) * 1000, suffixFrame: SEAT_SUFFIX_FRAME },
    { kind: '흐르는글', text: stadiumLineOf(record.stadiumEquipped) },
    { kind: '그림', frame: teamTypeFrameOf(teamAbilities) },
    record.regularSeasonFirsts === 0
      ? { kind: '글', text: NO_VALUE_TEXT }
      : { kind: '숫자', value: record.regularSeasonFirsts },
    record.games === 0 ? { kind: '글', text: NO_VALUE_TEXT } : { kind: '숫자', value: rank + 1 },
  ]
  return TEAM_INFO_LABEL_FRAMES.map((labelFrame, index) => ({ labelFrame, value: values[index] }))
}
