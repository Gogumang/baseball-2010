/**
 * 스킨(메인 메뉴 객체 [0x1552cfc]) 이 그리는 **두 바탕** — 명예의 전당 목록을 쓰는 화면들이 목록 0x63b15 앞에 깐다.
 *
 * ## 1. 메뉴 바탕 `0x58371(skin, 그림, 다시 짓기)` (직접 떴다, 0x58370~0x58572)
 * 부르는 곳: 스페셜 명예의 전당(하위 27, 0x2dcd8) · 미션 선수 고르기(하위 17, 0x2dec8) · 홈런더비 선수 고르기(하위 16, 0x2df20)
 * · 기록연감(0x2e29c) · 도움말(0x2fc8c) 등 — 모두 `0x58371(skin, [메뉴+0x90] = mainui/main_title.pzx, 0)`.
 * ```
 * 다시 짓기 ≠ 0 (메인 메뉴 들어올 때 0x234d4 · 상태 진입 0x24a40 · 0x25b88 이 1 로 부른다):
 *   0x6a735(gfx, RGB(255,255,255))                                 ; 화면 흰색
 *   0xba759(그림, 13, 프레임, 0, 0)                                  ; main_title 프레임 13 (240×320 전면 그림)
 *   0xba759(그림, 7, 이미지, W − 이미지7폭 − 2, 2)                    ; 이미지 7 (40×46) 을 오른쪽 위 (198, 2)
 *   0xbdd65(1)                                                      ; (그리기 모드 — 내부 미해독)
 *   y = 0, 3, 6, … < H: 선 0x6a905(gfx, 0, y, W, y, 0x10000000)     ; 3줄마다 검정 선, 색 위 바이트 = 알파 0x10
 *   [0x15605d0](0, 0, W, H, RGB(255,255,255), 단계 3)               ; 화면 전체를 흰색 단계 3 으로 덮기
 *   [skin+0x450] = 0xbda01(…, 0x1552ae4)                            ; 그린 화면을 W×H 버퍼에 떠 둔다(메모리 되면 1)
 * 다시 짓기 == 0 (화면들이 매 그림 부르는 쪽):
 *   [skin+0x450] ≠ 0 → 0xbdbcd: 떠 둔 버퍼를 (0, 0) 에 그대로 찍고 끝
 *   아니면 프레임 13 · 이미지 7 · 0xbdd65(0) · 흰 단계 3 덮기 (3줄 선은 없다)
 * ```
 * 메인 메뉴에 들어올 때 버퍼를 떠 두므로 선수 고르기·명예의 전당이 보는 것은 **떠 둔 버퍼** — 3줄 선까지 있는 쪽이다.
 * 같은 버퍼를 0x581dd(경기 쪽 바탕)도 떠 쓰지만, 이 화면들은 메인 메뉴 상태 진입에서 다시 지은 뒤라 0x58371 의 그림이다.
 * ⚠️ 근사: 흰 덮기 [0x15605d0] 단계 3 의 불투명도는 그 함수 본문을 못 읽어 다른 화면처럼 **단계/16** 으로 둔다.
 *    선 알파 0x10 은 0x6a918(알파 0·0xff 는 안 섞음)과 같은 뜻으로 **÷ 255** (메인 메뉴 바탕 띠와 같은 해석).
 *
 * ## 2. 공 무늬 바탕 `0x5fd61(skin, x, y, w, h)` (직접 떴다, 0x5fd60~0x5fec0)
 * 부르는 곳: 나리 명예의 전당 등록(상태 145 — 0x16928 이 상태 142~144 밖이면 `0x5fd61(skin, 0, 0, W, H)`) ·
 * 시즌 공통 앞그림 0xb810(0xdd · 0xe0 · 0xe1 밖, 선수영입 0xe2 포함) 등.
 * ```
 * [skin+0x9c](ui/gpoint.pzx) 가 없으면 아무것도 안 그림
 * 0x6a9f1(gfx, 0, 0, W, H, RGB(0x93, 0xc7, 0xe5))                  ; 하늘색 채우기
 * (w, h) = gpoint 이미지 12 크기 (23×23) · 열 = W / w + 3 = 13 · 줄 = H / h + 2 = 15
 * c = [skin+0x414] · 시작 = 2 × (c − w)
 * 0xbae25(x, y, w, h)                                              ; 자르기
 * 줄 r = 0 … 줄−1, 칸 k = 0 … 열−1:
 *   0xba759(gpoint, 애니 0, 종류 2, 시작 + (w + 15)·k − (r 홀수 ? (w + 15) >> 1 : 0), 시작 + (w + 15)·r)
 * 0x93d91(gpoint 애니)                                             ; 애니를 한 번 진행 (그린 뒤)
 * 0xbaf8d()                                                        ; 자르기 풂
 * c < w + 15 ? c + 1 : 1 → [skin+0x414]
 * ```
 * → 공 아이콘(애니 0 = 프레임 0~5 지연 3)이 38px 간격 엇갈린 격자로 깔려 **틱마다 오른쪽 아래로 2px** 흐른다.
 * c 는 1 → 38 을 돌아 시작이 −44 → 30 을 오가는데, 38 에서 1 로 돌 때 74px 만 되돌아가(무늬 한 주기는 76px)
 * 한 바퀴마다 2px 튄다 — **원본 그대로**.
 * [skin+0x414] 를 0 으로 놓는 곳은 스킨을 만들 때 0x5390c(0x53a1e) 하나뿐이라 화면을 건너 이어진다.
 */

export const SKIN_SCREEN = { width: 240, height: 320 } as const

/** 1. 메뉴 바탕 — main_title 프레임 13 · 이미지 7 (40×46) 을 (W − 40 − 2, 2) */
export const MAIN_TITLE_BACKDROP = {
  frame: 13,
  badgeImage: 7,
  badgeWidth: 40,
  badgeX: SKIN_SCREEN.width - 40 - 2,
  badgeY: 2,
  /** 3줄마다 검정 선 — 0x58426 `adds r6, #3` */
  lineStep: 3,
  /** 선 색 0x10000000 의 위 바이트 = 알파 0x10 (/255) */
  lineOpacity: 0x10 / 255,
  /** 흰 덮기 단계 3 — ⚠️ 단계/16 근사 */
  whitenOpacity: 3 / 16,
} as const

/** 3줄 선의 y — 0 · 3 · … · 318 */
export function mainTitleLineYs(): readonly number[] {
  const ys: number[] = []
  for (let y = 0; y < SKIN_SCREEN.height; y += MAIN_TITLE_BACKDROP.lineStep) ys.push(y)
  return ys
}

/** 2. 공 무늬 바탕 */
export const BALL_PATTERN_BACKDROP = {
  color: 'rgb(147, 199, 229)',
  /** gpoint 이미지 12 크기 (0x5fdc2 `0xba815(…, 0xc, 0)`) */
  tileWidth: 23,
  tileHeight: 23,
  /** 칸 사이 15 (0x5fe1c · 0x5fe7a `adds #0xf`) */
  gap: 15,
} as const

const { tileWidth, tileHeight, gap } = BALL_PATTERN_BACKDROP
export const BALL_PATTERN_COLUMNS = Math.trunc(SKIN_SCREEN.width / tileWidth) + 3
export const BALL_PATTERN_ROWS = Math.trunc(SKIN_SCREEN.height / tileHeight) + 2
/** 한 주기 — c 가 이 값에 닿으면 1 로 돈다 */
export const BALL_PATTERN_PERIOD = tileWidth + gap

/** [skin+0x414] 다음 값 (0x5fea4~0x5feb8) */
export const nextBallPatternCounter = (counter: number) => (counter < BALL_PATTERN_PERIOD ? counter + 1 : 1)

/** 0 에서 시작해 n 번 그린 뒤의 [skin+0x414] */
export function ballPatternCounterAfter(draws: number): number {
  if (draws <= 0) return 0
  // 0 → 1 → … → 38 → 1 → … (첫 그림 뒤 1, 그 뒤로 38 주기)
  return ((draws - 1) % BALL_PATTERN_PERIOD) + 1
}

/** c 일 때 공 칸들의 왼쪽 위 — 줄마다 홀수 줄은 반 칸 왼쪽 */
export function ballPatternTilesOf(counter: number): readonly { readonly x: number; readonly y: number }[] {
  const start = 2 * (counter - tileWidth)
  const stepX = tileWidth + gap
  // 줄 간격도 높이가 아니라 **폭** + 15 다 (0x5fe74 `adds r3, r2, r7` — r7 = 폭). gpoint 12 는 23×23 이라 같다
  const stepY = tileWidth + gap
  const tiles: { x: number; y: number }[] = []
  for (let row = 0; row < BALL_PATTERN_ROWS; row += 1) {
    for (let column = 0; column < BALL_PATTERN_COLUMNS; column += 1) {
      tiles.push({ x: start + stepX * column - (row % 2 === 1 ? stepX >> 1 : 0), y: start + stepY * row })
    }
  }
  return tiles
}
