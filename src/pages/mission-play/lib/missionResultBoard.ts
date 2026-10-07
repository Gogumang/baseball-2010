/**
 * **미션 결과 판** — 경기 상태 0x19 그리기 `0x4a384` 의 모드 5·6 갈래(0x4a576~0x4a8ec) · 키 `0x407f0`(0x40816~0x40946) ·
 * 진입 `0x4ea0c` 의 모드 5·6 갈래(0x4ef18~0x4f01e). 직접 떴다.
 *
 * ## 그리기 0x4a384 (W = 240 · H = 320)
 * 앞부분은 팀경기 정산 판과 같다(`pages/team-game/lib/settlementBoard` 머리말):
 * ```
 * 4a3d2  이겼나 sp+0x98 = 모드 5·6 이면 [미션+0xbc] — 미션 끝 0x509a0 → 0xa5368(obj, 목표 달성?) 이 적은 성공 여부
 * 4a404  실패면 [0x15605d0] 색 덮기 검정 단계 8
 * 4a448  띠 fillRect(0, 40, W, 30, 0x80304EA2) · game_ui 프레임 8 (W/2 − 폭/2, 35)
 * 4a4d2  ui/result.pzx(진입 0x4ea0c 가 [+0x1048] 에 올린다) 프레임 성공 0 "YOU WIN" · 실패 1 "YOU LOSE" 를 (W/2, 50)
 * 4a562  모드(g[1]) 5·6 이면 여기(0x4a576):
 * 4a576  전역 기록 g = 0x1f1d8([0x1400054]) — g[0x11f] ≠ 0 이거나 g[0x176] ≠ 0(마선수 대결)이면 여기서 끝 (0x4b086)
 * 4a5f4  창 0x55e61(skin, W/2, H/2, 0xb0, 0x98, 0, 0x22, 0x10)                 → (32, 84, 176, 152)
 * 4a650  game_ui 이미지 30 "RESULT" 를 (W/2 − 폭/2, H/2 − 0x45)                → (92, 91)
 * 4a67e  칸 0xbb28d(W/2, H/2 − 0x33, 162, 0x3d, 2)                             → (39, 109, 162, 61)
 * 4a69c  칸 0xbb28d(W/2, H/2 + 0x10, 162, 0x31, 2)                             → (39, 176, 162, 49)
 * 4a6e4  img_text 256 "획득" (W/2 − 0x42, H/2 − 0x24) · 252 "GP" (W/2 − 0x25, 같은 y)
 * 4a73e  0x54a61(skin, [+0x17f4], W/2 − 0xb, H/2 − 0x27, 0x50, 0x10, 1, 1, 1, 0)  ; 획득 G — "+" 붙임
 * 4a76a  img_text 257 "보유" (W/2 − 0x42, H/2 − 0x10) · 252 "GP" (W/2 − 0x25, 같은 y)
 * 4a7c0  0x54a61(skin, g[0x64], W/2 − 0xb, H/2 − 0x13, 0x50, 0x10, 1, 1, 0, 0)   ; 보유 G
 * 4a804  StrMAINMENU[53] "!C!cFFFFFF재도전하시겠습니까?" 를 0xba269(글, W/2 − 0x51, H/2 + 0x17, 162, −1, 0)
 * 4a84e  popup 프레임 1 "예"  을 (W/2 − 0x51 + 0x30 − w/2, H/2 − 0x4c + 0x7f − h/2)   ; w × h = 프레임 1 크기 41 × 15
 * 4a884  popup 프레임 2 "아니오" 를 (W/2 − 0x51 + 0x72 − w/2, 같은 y)
 * 4a89a  [+0x17f9] ≠ 0 이면 popup 프레임 6(고른 "예") 을 "예" 자리에, 아니면 프레임 7(고른 "아니오") 을 "아니오" 자리에 덧그린다
 * ```
 * ## 진입 0x4ea0c 모드 5·6 (0x4ef18)
 * ```
 * 성공([미션+0xbc] ≠ 0):  g[0x11f] == 0 이고 g[0x176] == 0 이면 [+0x17f4] = [미션+0xa0](0xa5368 이 적은 보상 0xa52b0) ·
 *                          g[0x64] = clamp(g[0x64] + 보상, 0, 99999)
 * 실패:                    [+0x17f4] = 0
 * 끝 0x4f410  [+0x17f9] = 1 (커서 기본 "예")
 * ```
 * ## 키 0x407f0 (모드 5·6 — 0x40816)
 * ```
 * ←/→(−3 · −4) · '4' · '6'   : g[0x176] · g[0x11f] 둘 다 0 이면 [+0x17f9] 뒤집기 (0x40840)
 * OK(−5) · '5'               : g[0x11f] ≠ 0 이고 g[0x176] ≠ 0 이면 대결 끝 길(0x4090e) — 아니면
 *                              [+0x17f9] ≠ 0 → 0x140006c = 3(장면 0x107 상태 3: 같은 미션 곧바로 다시) · 0 → 1(미션 목록)
 * CLR(−16)                   : g[0x11f] · g[0x176] 하나라도 서 있으면 대결 끝 길(0x4090e) — 아니면 0x140006c = 1(미션 목록)
 * 그 뒤 화면 전환 0xbdae9([0x140007c], 1, 0, 5, 1500)
 * 대결 끝 길 0x4090e: g[0xf6](원래 모드) 가 4 · 3 이면 0x140006c = 0x69 · 화면 전환, 아니면 아무 일 없음
 * ```
 */

const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
const CENTER_X = SCREEN_WIDTH / 2
const CENTER_Y = SCREEN_HEIGHT / 2
const BOX_LEFT = CENTER_X - 0x51
const BOX_WIDTH = 162

/** 공용 창 0x55e61(W/2, H/2, 176, 152) — 가운데 기준 */
export const MISSION_RESULT_WINDOW = { x: CENTER_X - 88, y: CENTER_Y - 76, width: 0xb0, height: 0x98 } as const

/** game_ui 이미지 30 "RESULT" (56×7) 을 (W/2 − 28, H/2 − 0x45) */
export const MISSION_RESULT_TITLE = { image: 30, x: CENTER_X - (56 >> 1), y: CENTER_Y - 0x45 } as const

/** 칸 0xbb28d — x 가 가운데라 왼쪽 = W/2 − 81 */
export const MISSION_POINT_BOX = { x: BOX_LEFT, y: CENTER_Y - 0x33, width: BOX_WIDTH, height: 0x3d } as const
export const MISSION_RETRY_BOX = { x: BOX_LEFT, y: CENTER_Y + 0x10, width: BOX_WIDTH, height: 0x31 } as const

/** img_text 252 "GP" */
export const MISSION_GP_FRAME = 252
export const MISSION_POINT_LABEL_X = CENTER_X - 0x42
export const MISSION_POINT_GP_X = CENTER_X - 0x25

/** 획득 · 보유 줄 — 0x54a61(skin, 값, W/2 − 0xb, y, 0x50, 0x10, 판 1, 정렬 1, "+", 둥근판 0) */
export const MISSION_POINT_ROWS = [
  { label: 256, name: '획득', labelY: CENTER_Y - 0x24, valueY: CENTER_Y - 0x27, plus: true },
  { label: 257, name: '보유', labelY: CENTER_Y - 0x10, valueY: CENTER_Y - 0x13, plus: false },
] as const
export const MISSION_POINT_VALUE = { x: CENTER_X - 0xb, width: 0x50, align: 1, plate: false } as const

/** StrMAINMENU[53] 원문 — `!C` 가운데 · `!cFFFFFF` 흰색 */
export const MISSION_RETRY_QUESTION = '!C!cFFFFFF재도전하시겠습니까?'
export const MISSION_RETRY_TEXT = { x: BOX_LEFT, y: CENTER_Y + 0x17, width: BOX_WIDTH } as const

/** popup 프레임 1 의 크기 41×15 — 두 단추 · 덧그림 모두 이 크기로 자리를 잡는다 (0x4a808 0xba815 한 번) */
const POPUP_BUTTON = { width: 41, height: 15 } as const
const BUTTON_Y = CENTER_Y - 0x4c + 0x7f - (POPUP_BUTTON.height >> 1)

/** 예 · 아니오 — popup 프레임 1 · 2 를 늘 그리고, 고른 쪽에 6 · 7 을 덧그린다 */
export const MISSION_RETRY_BUTTONS = [
  { answer: true, name: '예', frame: 1, selectedFrame: 6, x: BOX_LEFT + 0x30 - (POPUP_BUTTON.width >> 1), y: BUTTON_Y },
  { answer: false, name: '아니오', frame: 2, selectedFrame: 7, x: BOX_LEFT + 0x72 - (POPUP_BUTTON.width >> 1), y: BUTTON_Y },
] as const

/** [+0x17f9] 기본값 1 = "예" (0x4f410) */
export const MISSION_RETRY_DEFAULT_ANSWER = true

/** g[0x64] 상한 (0x4ef76 `0x1869f`) */
const MAXIMUM_GAME_POINT = 99999

/** 진입 0x4ea0c 의 [+0x17f4] — 성공이고 마선수 대결이 아니면 보상, 그 밖엔 0 */
export function missionResultEarnedOf(isSuccess: boolean, isAceMatch: boolean, reward: number): number {
  if (!isSuccess || isAceMatch) return 0
  return reward
}

/** 진입 0x4ea0c 가 더한 뒤의 g[0x64] — 0..99999 로 자른다 */
export function missionResultHeldOf(heldBefore: number, earned: number): number {
  return Math.min(MAXIMUM_GAME_POINT, Math.max(0, heldBefore + earned))
}

/** 키 0x407f0 모드 5·6 의 뜻 */
export type MissionResultKeyAction = '뒤집기' | '확인' | '취소' | null

export function missionResultKeyActionOf(key: string): MissionResultKeyAction {
  if (key === 'ArrowLeft' || key === 'ArrowRight' || key === '4' || key === '6') return '뒤집기'
  if (key === 'Enter' || key === ' ' || key === '5') return '확인'
  if (key === 'Escape' || key === 'Backspace') return '취소'
  return null
}

/** 판에서 나가는 곳 — 0x140006c = 3(같은 미션 다시) · 1(미션 목록) · 대결 끝 길 0x4090e */
export type MissionResultExit = '다시' | '목록' | '대결끝'

/**
 * 키 하나의 결과 — 마선수 대결은 `aceFlags` 의 g[0x11f] · g[0x176] 를 그대로 본다(OK 는 둘 다 서 있어야 대결 끝 길,
 * CLR 은 하나만 서도 대결 끝 길 — 원본 그대로). 커서를 뒤집으면 `toggle`, 나가면 `exit`.
 */
export function missionResultStepOf(
  action: MissionResultKeyAction,
  answer: boolean,
  aceFlags: { readonly flag11f: boolean; readonly flag176: boolean },
): { readonly answer: boolean; readonly exit: MissionResultExit | null } {
  const isAce = aceFlags.flag11f || aceFlags.flag176
  if (action === '뒤집기') return { answer: isAce ? answer : !answer, exit: null }
  if (action === '확인') {
    if (aceFlags.flag11f && aceFlags.flag176) return { answer, exit: '대결끝' }
    return { answer, exit: answer ? '다시' : '목록' }
  }
  if (action === '취소') return { answer, exit: isAce ? '대결끝' : '목록' }
  return { answer, exit: null }
}
