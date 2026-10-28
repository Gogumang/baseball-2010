/**
 * **투수 등록 0x66 · 변화구 고르기 0x67** 배치 (나리 장면 0x106, 모드 3). 모두 직접 떴다 — 0x15f34 · 0x162bc · 0x7c450 을
 * unicorn 으로 그대로 돌려 그리기 호출을 받았다.
 *
 * 둘 다 장면 틀 0x16928 의 "그 밖" 갈래라 공 무늬 바탕 0x5fd61 위에 그리고, 머리띠 0x7f4ed 는 제목 9(`나만의리그투수편`) · 바닥 5 다.
 * ```
 * 0x66 그리기 0x15f34
 *   0x7f4ed 머리띠 → 카드 0x15e20(카드 판 0x7ba44 · 투수 그림 · [gfx+0x28] = 1 로 정보 칸 0x7c450)
 *   값 칸 R = mode_ui 1 박스 2 (60,184,81,15) — 줄 0 · 1 은 y += (줄 + 1) × 17 · 줄 2~4 는 박스 4 (176,184,32,15) 에 y += (줄 − 2) × 17
 *   틱 % 10 ≠ 0 이면 0xba015((R.x − 1, R.y − 1, R.w + 2, R.h + 2), 둥글기 1, RGB(255,255,0))          ; 커서
 *   줄 ≠ 0 이면 mode_ui 24 를 R 에 0xb9e05(정렬 0x21) · (정렬 0x24, 효과 0x11 뒤집기, ox = 폭)        ; 값 화살
 *   0x677d5(입력기, 박스 2.x + 2, 박스 2.y + 17 + 3, 글꼴, RGB(255,255,0), 줄 == 0, 0x11, 0)           ; 이름 글 (62,204) 노랑
 *   줄 == 0 이면 칸 M = (R.x + R.w − 20, R.y + 1, 14, 14) = (121,202,14,14):
 *     0xba0bd(M, 둥글기 1, RGB(0x2E,0x46,0x94)) · 0x676f9(입력기, M.x + 2, M.y + 2, …, RGB(255,255,0)) ; 입력 방식 칸 · 글
 *     mode_ui 24 를 M 에 (정렬 0x21, ox −5) · (정렬 0x24, 효과 0x11, ox 10)
 *   0x55545(설명 띠, StrMODE[줄별 0xcc6d8 점프: 3 · 8 · 5 · 10 · 11])   ; 투수 — 타자는 3 · 7 · 4 · 9 · 11
 * 정보 칸 0x7c450 (모드 3 · [gfx+0x28] = 1)
 *   판 0x7c110(gfx, mode_ui 1 박스 0 = (21,176,196,83), 0) · 0xba19d(mode_ui 1, 0, 0)
 *   이름표 img_text (정렬 0x24 오른쪽, 위 + 3): 1열 x 30 폭 25 — 81 팀명 · 320 이름 · 321 타입 · 322 필살 (y 184 + 17k)
 *                                         2열 x 147 폭 25 — 323 보직 · 324 손(**정렬 0x22, ox 3**) · 325 피부 (넷째 타순 없음)
 *   팀 이름 img_text (0x41 + 팀) 를 박스 2 가운데 · 흰 글(0x9c735) 0xba411(칸, 글, 정렬 0x22):
 *     타입(60,218,81,15) · 보직(176,184,32,15) · 손(176,201) · 피부(176,218). 이름 줄은 [gfx+0x28] 이라 안 쓴다(입력기 몫),
 *     필살 줄은 레코드 +0x18 > 0 일 때만 StrCOMMON[0x18 + n + 6] — 새 선수는 0 이라 비어 있다
 *   (2026-10-15 r80 다시 뜸 — 0x7c450 모드 3 갈래, `[gfx+0x20]` 2 · 3 · 4 를 0x7b998 · 0x7b984 · 0x7b970 이 본다)
 *     이름(7c81e)  [gfx+0x28] == 0 이면 0xb62c1(레코드) 이름을 (60,201) 정렬 0x22
 *     타입(7c94a)  0x1400258[(+0xb >> 5) + 2] — 표 [타격형, 장타형, 오버핸드, 사이드암, 언더스로]
 *     필살(7cb5c)  n = +0x18 > 0 이면 StrCOMMON[0x18 + n + 6 + (n == 4 ? +0xb >> 5 : 0)] — 번호 4 는 타입으로 샤이닝 · 캐넌 · 미라지
 *     보직(7ccda)  0x1400248[min(0xb6705 보직, 1) + 2] — 표 [내야, 외야, 선발, 구원] (보직 1 · 2 는 구원)
 *     손(7cdca)    0x1400238[0xb63c1 손 + 2] — 표 [우타, 좌타, 우완, 좌완]
 *     피부(7cefc)  0x140022c[+0xb 비트 2~3] — 표 [황인, 백인, 흑인]
 * 0x67 그리기 0x162bc
 *   카드 0x15e20(정보 칸은 0x15ef0 이 건너뛴다) · 판 0x7c110(박스 (21,176,196,83), 0) · 0xba19d(mode_ui 4, 0, 0)
 *   줄 번호 k = 0..3: 0xba719((50, 183 + 19k, 18, 15), 자간 0, 표 0xcc6f0[k] = 2 · 4 · 6 · 8, 기준 0x32, num, 정렬 0x22, 0, oy 1)
 *   칸 i = 0..7 (mode_ui 4 박스 i + 1): slt_pitch[구질 − 1] 정렬 0x22 (제 색)
 *     골랐으면 mode_ui 7(주황 판) · 그 이름을 효과 0xb 검정으로 (−1,0) · (0,−1) · (+1,0) · (0,+1) 에 찍고 노랑(255,255,0) 을 제자리에
 *     커서 칸이고 틱 % 10 ≠ 0 이면 0xba015((x − 1, y − 1, w + 2, h + 2), 둥글기 1, 노랑)
 *   OK 칸 (박스 9 = (92,263,60,11)): 커서 8 이면 mode_ui 6(주황) 아니면 5(파랑) 를 정렬 0x11 · ox 28 · oy −2 → (120, 261)
 *   0x7f4ed 머리띠 · 틱 ≤ 0x31 이면 0x55545(설명 띠, StrMODE[12])
 * ```
 */

export type RegisterBox = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

/** 정보 판 0x7c110 (mode_ui 1 · 2 박스 0) */
export const REGISTER_INFO_BOARD: RegisterBox = { x: 21, y: 176, width: 196, height: 83 }
export const REGISTER_INFO_FRAME = 1
export const REGISTER_ROW_STEP = 17

/** 0x66 줄(0 이름 · 1 타입 · 2 보직 · 3 손 · 4 피부)의 값 칸 R */
export function registerValueBoxOf(row: number): RegisterBox {
  if (row <= 1) return { x: 60, y: 184 + (row + 1) * REGISTER_ROW_STEP, width: 81, height: 15 }
  return { x: 176, y: 184 + (row - 2) * REGISTER_ROW_STEP, width: 32, height: 15 }
}

/** 커서 0xba015 상자 (R.x − 1, R.y − 1, R.w + 2, R.h + 2) — 둥근 테두리라 (w + 1) × (h + 1) 을 덮는다 */
export const cursorBoxOf = (box: RegisterBox): RegisterBox => ({ x: box.x - 1, y: box.y - 1, width: box.width + 2, height: box.height + 2 })

export const REGISTER_YELLOW = '#FFFF00'
/** 입력 방식 칸 M = (R.x + R.w − 20, R.y + 1, 14, 14) = (121,202,14,14) — 타자 등록과 같은 0x15f34 갈래라 `shared/ui/InputMethodText/InputModeBox` 가 그린다 */
export const INPUT_MODE_BOX: RegisterBox = { x: 121, y: 202, width: 14, height: 14 }
/** 이름 글 0x677d5 (박스 2.x + 2, 이름 줄 y + 3) */
export const NAME_TEXT_AT = { x: 62, y: 204 } as const

/** mode_ui 24 화살 (5×8) */
export const ARROW_FRAME = 24
const ARROW_WIDTH = 5
const ARROW_HEIGHT = 8
const arrowTopOf = (box: RegisterBox) => {
  const d = box.height - ARROW_HEIGHT
  return box.y + Math.trunc(d / 2) + (d % 2)
}

/** 화살 둘 — 왼쪽 (정렬 0x21, ox) · 오른쪽 뒤집기 (정렬 0x24, 효과 0x11, ox) */
export function arrowPairOf(box: RegisterBox, leftOx: number, rightOx: number) {
  const top = arrowTopOf(box)
  return {
    left: { x: box.x + leftOx, y: top },
    right: { x: box.x + box.width - ARROW_WIDTH + rightOx, y: top },
  }
}
/** 값 칸 화살 (ox 0 · 폭) */
export const valueArrowsOf = (row: number) => arrowPairOf(registerValueBoxOf(row), 0, ARROW_WIDTH)
export const ARROW_SIZE = { width: ARROW_WIDTH, height: ARROW_HEIGHT } as const

/** 줄별 설명 띠 StrMODE (점프표 0xcc6d8, 투수 갈래) */
export const REGISTER_ROW_HINTS: readonly number[] = [3, 8, 5, 10, 11]

/** 정보 칸 이름표 (img_text) — 정렬 0x24 는 오른쪽, 324 "손" 만 정렬 0x22 · ox 3 */
export interface RegisterLabel {
  readonly frame: number
  readonly box: RegisterBox
  readonly align: 0x22 | 0x24
  readonly ox: number
}
const labelBox = (x: number, row: number): RegisterBox => ({ x, y: 184 + row * REGISTER_ROW_STEP, width: 25, height: 15 })
export const REGISTER_LABELS: readonly RegisterLabel[] = [
  { frame: 81, box: labelBox(30, 0), align: 0x24, ox: 0 },
  { frame: 320, box: labelBox(30, 1), align: 0x24, ox: 0 },
  { frame: 321, box: labelBox(30, 2), align: 0x24, ox: 0 },
  { frame: 322, box: labelBox(30, 3), align: 0x24, ox: 0 },
  { frame: 323, box: labelBox(147, 0), align: 0x24, ox: 0 },
  { frame: 324, box: labelBox(147, 1), align: 0x22, ox: 3 },
  { frame: 325, box: labelBox(147, 2), align: 0x24, ox: 0 },
]
/** 팀 이름 img_text 0x41 + 팀 — 박스 2 (60,184,81,15) 가운데 */
export const TEAM_NAME_BOX: RegisterBox = { x: 60, y: 184, width: 81, height: 15 }
export const teamNameFrameOf = (teamId: number) => 0x41 + teamId
/**
 * 흰 글 칸 — 0x7c450 이 박스 2 (60,184,81,15) 에서 y += h + 2 로 내려가며 · 박스 4 (176,184,32,15) 도 같다.
 * 이름 · 필살은 등록(0x66, [gfx+0x28] = 1)에서는 비고, 기본정보(119)에서만 선다.
 */
export const REGISTER_TEXT_BOXES = {
  이름: { x: 60, y: 201, width: 81, height: 15 },
  타입: { x: 60, y: 218, width: 81, height: 15 },
  필살: { x: 60, y: 235, width: 81, height: 15 },
  보직: { x: 176, y: 184, width: 32, height: 15 },
  손: { x: 176, y: 201, width: 32, height: 15 },
  피부: { x: 176, y: 218, width: 32, height: 15 },
} as const satisfies Record<string, RegisterBox>

/** 0x67 — mode_ui 4 */
export const BREAKING_PITCH_FRAME = 4
/** 줄 번호 칸 (박스 0 에서 y + 19k) 과 표 0xcc6f0 */
export const BREAKING_ROW_NUMBERS: readonly number[] = [2, 4, 6, 8]
export const BREAKING_ROW_NUMBER_BASE = 0x32
export const breakingRowNumberBoxOf = (row: number): RegisterBox => ({ x: 50, y: 183 + row * 19, width: 18, height: 15 })
/** 칸 i (mode_ui 4 박스 i + 1) */
export function breakingPitchBoxOf(cell: number): RegisterBox {
  return { x: cell % 2 === 0 ? 76 : 138, y: 183 + Math.trunc(cell / 2) * 19, width: 53, height: 15 }
}
/** 고른 칸 판 mode_ui 7 (53×15) */
export const BREAKING_CHOSEN_PLATE = 7
/** OK 칸 mode_ui 5 파랑 · 6 주황(커서) — 박스 9 (92,263) 에 ox 28 · oy −2 */
export const BREAKING_OK = { blue: 5, orange: 6, x: 92 + 28, y: 263 - 2, width: 66, height: 12 } as const
/** 이름 테두리 — 효과 0xb 검정을 네 방향 1px (0x16446~0x16548) */
export const BREAKING_NAME_OUTLINE: readonly (readonly [number, number])[] = [
  [-1, 0],
  [0, -1],
  [1, 0],
  [0, 1],
]
/** StrMODE[12] — 상태 틱 ≤ 0x31 (0x16690) */
export const BREAKING_HINT = 12
