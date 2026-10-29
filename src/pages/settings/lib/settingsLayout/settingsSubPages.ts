import { PANEL, TITLE, X1 } from '@/pages/settings/lib/settingsLayout/settingsRows'

/**
 * 상세 설정 (메인 메뉴 상태 0x20 · 페이지 32 — 그리기 0x59e82~0x5a2f4 의 **4줄 루프** `cmp r6,#4`,
 * 갱신 0x288ac 는 칸 0~3 을 누를 때 값을 `eor #1` 로 뒤집는다 — P7 K2 확정). 배치는 직접 떴다:
 * ```
 * 줄 i = 0..3, Y = y0 + 30·i (첫 화면과 달리 −5 가 없다, 0x5a214 `adds #0x1e`)
 *   글머리 slt_frame 이미지 39 (x0 + 14, Y + 44)                                  ; 0x59f74
 *   이름 "!cffffff%s" StrMAINMENU[0x45 + i] (x0 + 28, Y + 41) 왼쪽 맞춤 흰색          ; 0x59f8c~0x59fb6
 *   아이콘 바탕 이미지 87 (x0 + 70, Y + 36) · 아이콘 표 0xd1afc 를 그 안 가운데           ; 0x59fd0 · 0x5a056
 *   값 막대 slt_frame 프레임 38 (x0 + 98, Y + 37)                                   ; 0x5a074
 *   값 칸 j = 0·1: StrMAINMENU[0xd1b04[i] + j] 를 (x0 + 98 + 39j, Y + 41) 폭 39 가운데,
 *        값 == j 면 "!C!cffffff%s"(0xcf2e0) 흰색 · 아니면 "!C!c7B93D4%s"(0xcf2f0)          ; 0x5a0ca~0x5a17e
 *   고른 줄: 글머리 자리에 이미지 38 덧그림                                            ; 0x5a19e
 *     깜빡일 때만([sp+0x9c]) 화살 이미지 20 (x0 + 91, Y + 41) · 뒤집어(0x11) (x0 + 177, Y + 41) ·
 *     흰 둥근 테두리 0x6aa65 (x0 + 96, Y + 37, 80×17, 둥글기 1)                         ; 0x5a1aa~0x5a20a
 * 줄 다음: 줄마다 지금 값 칸에 노랑 RGB(255,255,0x55) 테두리 0x6a979 (x0 + 99 + 39·값, Y + 38, 35×15) ; 0x5a226~
 * ```
 * 아래 OK 단추는 이 페이지에 없다. 다섯째 값(+0x14c 터치)은 값 배열에만 읽고 그리지 않는다.
 * 고른 줄 까딱임은 `ROW_SHAKE_TABLES` 머리말 — 첫 화면 · 모드 초기화와 같다.
 * 제목은 img_text **290 "상세 설정"**(46×10) — 그림 글자를 눈으로 확인한 것이라 **유력**.
 */
export const DETAIL_TITLE = { frame: 290, x: TITLE.x, y: TITLE.y } as const

/**
 * **고른 줄 까딱임** — 공용 판 0x593c8 의 세 페이지가 같은 꼴이다(직접 떴다):
 * ```
 * 0x59424  r7 = [skin+0x84](머리띠 미끄러짐 깃발) — 서 있으면 bl 0x5a772 = 함수 끝(+0x25 = 0 · pop)으로 뛰어 페이지를 안 그린다
 * 0x59462  머리: 격자 +0x25(커서 바뀜)가 섰으면 [skin+0x2c8] = r7(여기 닿으면 늘 0) ·
 *          [skin+0x2cc] = [skin+0x8c](0x5550d 가 적은 마지막 방향) · 설명 띠 다시 펴기([+0x88] · [+0x8a] = 1)
 * 줄 루프  [+0x2cc] ≠ −1 이고 줄 번호 == 커서면 dx = 0xd1784[2·방향 + t] · dy = 0xd1754[3·방향 + t], t = [+0x2c8] 을 올리고
 *          t > 1 이면 [+0x2cc] = −1 — 첫 화면 0x59600~0x59644 · 상세 설정 0x59f04~0x59f4a · 모드 초기화 0x5a386~0x5a3cc
 * ```
 * 옮긴 (x0 + dx, Y + dy) 는 그 줄 루프의 그림 모두에 쓴다 — 글머리 · 이름 · 아이콘 바탕 · 막대 · 화살 · 흰 테두리 · (상세 설정) 아이콘 ·
 * 값 칸 글. 첫 화면의 아이콘 · 값 그림(0x59902~)과 진동 · 상세 값 노랑 테두리(줄 뒤)는 제자리다. 표 값은 기록연감과 같다
 * (`shared/lib/cursorShake`) — 두 그리기, ↑ (0,−2)(0,+2) · ↓ (0,+2)(0,−2). 1열 격자라 좌우 키는 커서를 안 옮겨 까딱이지 않는다.
 * **진입 첫 그림 (U-123, 직접 떴다)**: t 가 1 에서 시작하는 길은 없다 — [+0x2c8] 에 [skin+0x84] 를 쓰는 59472 는 r7 = 0 일 때만 닿는다.
 * 격자 +0x25 는 생성 0x6bd38 이 0 으로 두고 커서 놓기 0x6c00c · 설정 0x6bfe0 은 안 건드리며, 키 처리 0x6c031 이 들어올 때 지우고
 * 커서가 옮겨 가면 세운다. 머리띠가 미끄러지는 그리기(메인 메뉴에서 들어옴 · 0x20 · 0x21 진입)는 페이지를 안 그리고 +0x25 만 지우므로
 * 그동안 누른 세로 키는 커서만 옮기고 까딱이지 않는다(`isFrameSlidingAt`). 하위 페이지에서 돌아온 첫 화면은 CLR 이 키 처리에서
 * +0x25 를 지운 뒤라 까딱이지 않는다. 숫자 키로 커서가 옮겨 가면 +0x25 가 서고 방향은 [skin+0x8c] 에 남은 마지막 화살표다 — 웹은
 * 숫자 키로 줄을 고르지 않는다.
 */
export const ROW_SHAKE_TABLES = { x: 0xd1784, y: 0xd1754 } as const

export const DETAIL_ROWS = [
  // 이름 StrMAINMENU[69] · 값 [74] 기본 / [75] 게이지 — 기본값 0 = 기본(게이지 OFF)
  { name: '투구', icon: { image: 93, width: 13, height: 13 }, labels: ['기본', '게이지'] },
  // 이름 [70] · 값 [76] 수동 / [77] 자동 — 기본값 1 = 자동
  { name: '주루', icon: { image: 94, width: 12, height: 12 }, labels: ['수동', '자동'] },
  // 이름 [71] · 값 [76] 수동 / [77] 자동 — 기본값 0 = 수동
  { name: '송구', icon: { image: 90, width: 16, height: 11 }, labels: ['수동', '자동'] },
  // 이름 [72] · 값 [78] OFF / [79] ON — 기본값 1 = ON
  { name: '전광판', icon: { image: 97, width: 14, height: 14 }, labels: ['OFF', 'ON'] },
] as const

export const DETAIL_ROW_COUNT = DETAIL_ROWS.length

/** Y_i = y0 + 30i */
export const detailRowTopOf = (index: number) => PANEL.y + 30 * index

export const DETAIL_ROW = {
  bulletImage: 39,
  selectedBulletImage: 38,
  bullet: { x: PANEL.x + 14, dy: 44 },
  name: { x: PANEL.x + 28, dy: 41 },
  iconBackImage: 87,
  iconBack: { x: PANEL.x + 70, dy: 36 },
  barFrame: 38,
  bar: { x: PANEL.x + 98, dy: 37 },
  arrowImage: 20,
  leftArrow: { x: PANEL.x + 91, dy: 41 },
  rightArrow: { x: PANEL.x + 177, dy: 41 },
  outline: { x: PANEL.x + 96, dy: 37, width: 80, height: 17 },
} as const

/** 값 칸 j — (x0 + 98 + 39j, Y + 41) 폭 39 */
export const DETAIL_CHOICES = [
  { x: PANEL.x + 98, dy: 41, width: 39 },
  { x: PANEL.x + 98 + 39, dy: 41, width: 39 },
] as const

/** 지금 값 칸 노랑 테두리 — (x0 + 99 + 39·값, Y + 38, 35×15) */
export const detailValueOutlineOf = (value: number) => ({ x: PANEL.x + 99 + 39 * value, dy: 38, width: 35, height: 15 })

/** 값 글 색 — 고른 칸은 흰색, 아닌 칸은 메뉴 줄과 같은 #7B93D4 */
export const DETAIL_COLORS = { selected: '#FFFFFF', unselected: '#7B93D4' } as const

/**
 * 환경설정 → **모드 초기화** (메인 메뉴 상태 0x21 · 공용 페이지 0x593c8 종류 0x21 — 그리기 0x5a316 직접 읽음).
 *
 * ```
 * 제목 img_text 프레임 0x123 = 291 "모드 초기화"(58×10) 를 (x1 − w/2 + 31 = 36, y0 + 5)   ; 0x5a316~0x5a370
 * 줄 i = 0..2, Y_i = y0 + 30·i (첫 화면과 달리 −5 가 없고 간격 0x1e)                      ; 0x5a3ce · 0x5a4e8
 *   글머리 slt_frame 이미지 39 (x0 + 0x18, Y + 0x2c)                                       ; 0x5a3f6
 *   막대 slt_frame 프레임 36(114×18) (x0 + 0x32, Y + 0x25)                                  ; 0x5a42c
 *   이름 StrMAINMENU[0x52 + i] 가운데, 폭 = 프레임 36 폭 (x0 + 0x32, Y + 0x28)             ; 0x5a440 · 0x5a47a
 *     고른 줄 "!C!cffffff%s"(0xcf2e0) 흰색 · 아닌 줄 "!C!c7B93D4%s"(0xcf2f0)
 *   고른 줄: 노란 네모 이미지 38 을 글머리 자리에 (x0 + 0x18, Y + 0x2c)                    ; 0x5a4a4
 *            + 흰 둥근 테두리 0x6aa65 (막대 자리, 둥글기 1)                                  ; 0x5a4de
 * ```
 * 아래 OK 단추는 종류 0x21 갈래에 없다 (0x5a4f6 → 0x5a6f8 끝).
 * 흰 테두리는 첫 화면처럼 깜빡인다 (`isSelectedOutlineShown`, 0x5a4ae).
 */
export const MODE_RESET_TITLE = { frame: 291, x: X1 - 29 + 31, y: PANEL.y + 5 } as const

export const MODE_RESET_ROW_COUNT = 3

export const modeResetRowTopOf = (index: number) => PANEL.y + 30 * index

export const MODE_RESET_ROW = {
  bulletImage: 39,
  selectedBulletImage: 38,
  bullet: { x: PANEL.x + 0x18, dy: 0x2c },
  barFrame: 36,
  bar: { x: PANEL.x + 0x32, dy: 0x25, width: 114, height: 18 },
  name: { x: PANEL.x + 0x32, dy: 0x28, width: 114 },
} as const

/**
 * 고른 줄 흰 테두리의 **깜빡임** — 공용 페이지 0x593c8 머리(0x593ce~0x593ee)가 그릴 때마다 skin+0x410 을 +1 한 뒤
 * `0xca911(카운터, 8) ≤ 3` 이면 [sp+0x9c] = 1 로 두고, 테두리 0x6aa65 는 그 값이 켜졌을 때만 그린다 —
 * 첫 화면(종류 8) 0x598c4 · 상세 설정(0x20) 0x5a1aa · 모드 초기화(0x21) 0x5a4ae. 8 갱신 중 4 갱신 보인다.
 * 판이 펼쳐지는 동안은 0x59548 이 0 으로 끈다 — `nextPanelFold` 참고.
 * 카운터는 앱에 하나인 [skin+0x410] 이다(앱을 켤 때 0, 화면을 건너 이어진다 — `useSkinBlinkCounter`, U-90). `counter` 는 올린 뒤의 값.
 */
export const isSelectedOutlineShown = (counter: number) => counter % 8 <= 3

/** 머리띠 `0x54d95(skin, 0, 5, 0)` — 제목 0 "2010프로야구" · 바닥 5(되돌아가기). 상태 8·0x20·0x21 그리기 0x2dc90 · 0x2dc48 · 0x2dc00 */
export const SETTINGS_FRAME = { title: '2010프로야구', footer: 5 } as const
