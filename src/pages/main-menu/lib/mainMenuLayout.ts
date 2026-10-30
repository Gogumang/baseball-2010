/**
 * 메인 메뉴 배치 — 원본 그림·좌표를 그대로 쓴다.
 *
 * 원작 메뉴는 **두 겹**이다. 어느 하위 상태든 먼저 반원 바퀴 판 0x24b1c 를 깔고,
 * 하위 목록이 있는 상태(5·6·9 …)는 그 위에 **세로 릴 0x2524c** 를 더 그린다
 * (부르는 곳 0x2857c·0x285ac·0x285dc·0x2860c·0x2863c 가 모두 `0x24b1c` → `0x2524c` 짝이다).
 *
 * ## 두 단이 **같은 모델**이다 — 각도가 아니라 **배열이 돈다**
 * 커서가 칸 사이를 옮겨 다니는 것이 아니라, 화면 자리는 고정이고 **항목 배열이 한 칸씩 회전**한다.
 * 회전 함수는 윗단·아랫단이 **같은 0x24780** 이다 (윗단 0x24c58, 아랫단 0x253a6).
 *   `0x24780(obj, arr, n, dir)` — arr 에서 −1 이 아닌 구간만 찾아
 *   dir −1 이면 오른쪽 1칸, dir −2 면 왼쪽 1칸 돌린다. **고른 칸은 언제나 그 구간의 첫 칸**이다.
 * 키도 같다 (상태 4 는 0x294e6, 상태 5 는 0x28e26): ↑·← = −1, ↓·→ = −2.
 *
 * ## 윗단 (하위 상태 4, 반원 바퀴) — 확정
 * - 중심 `(scrW>>1, scrH)` = **(120, 320)** — 0x237c4(폭 0x14008b8) · 0x237d6(높이 0x14008c8)
 * - 테두리 원 3겹: 반지름 **93 · 95 · 97**, 색 RGB(37,55,120) · RGB(138,185,235) · RGB(36,55,120) — 0x24cf6~0x24d70
 * - 가운데에 main_ball 애니 0 을 (120,320) 기준점으로 그린다 — 0x24cda
 * - 각도 표 0xcead4 = **[0,45,90,180,270,315]** (s16), 순서 표 0xceae0 = [0..5]
 * - 칸 그림 표 **0xcea6c = [0,1,2,3,4,26]** (u32, `ui/img_text` 프레임) — 상태 4 진입 0x258fc 가
 *   전역 `[0x1552d4c]` 로 통째로 복사하고, 그 배열이 0x24c58 에서 돈다. **확정**
 *   (예전 주석이 "눈으로 맞춘 유력" 이라 했는데 값은 그대로 맞았다.)
 * - 칸 위치: `x = 120 + (cos a·93 >> 16) + (a 가 [90,270] 밖이면 20)`, `y = 320 + (sin a·93 >> 16)` — 0x24e8a~0x24eba
 * - 도는 동안 각 = 표값 ± 카운터×9, **90° 벌어지는 칸만 ×18** — 0x24de6~0x24e2c
 * - 카운터 0→4, 5틱째에 배열을 돌린다 — 0x24c42~0x24c4c
 * - 칸 그림은 기준점 가운데 맞춤 `(x − w/2, y − h/2)`, 폭·높이는 그 img_text 프레임 것이다 — 0x24fc4~0x24fe2
 * - **각이 19 미만이거나 341 초과면 아예 안 그린다** — 0x24ef0. 고른 칸은 배열 0번 = 각도 0° 라
 *   **늘 이 구간에 들어간다 → 고른 칸은 바퀴에 안 그려지고 설명 판이 대신한다.**
 * - 커서 [obj+0xe8] 은 0~5 로 감싼다 — 0x24bfa~0x24c14. OK 를 누르면 표 0xcebdc = [5,6,7,8,9,10]
 *   으로 하위 상태를 고른다 (0x294a2) → 게임시작 5 · 스페셜 6 · 도움말 7 · 환경설정 8 · 랭킹 9 · 게임문의 10.
 *
 * ## 아랫단 (세로 릴 0x2524c) — 확정
 * 아래 `MENU_REEL_*` 주석 참고. 표 넷을 전부 binary.mod 에서 다시 떠 대조했다.
 *
 * ## 아랫단 바탕 띠 — 확정 (아래 `MENU_BAND_*` 참고)
 * **"윗단 잔상" 과 "아랫단 바탕 그라데이션" 은 서로 다른 연출이 아니라 같은 코드 한 덩이다.**
 * 0x253e8~0x2548e 밖에 `[메뉴+0xe4]` 를 읽는 곳이 없고(0xe2·0xe4 를 쓰는 곳은 0x23840·0x254e6·0x25512 와
 * 처음 메뉴 OK 0x294b8~0x294c2 — 이것은 예전에 놓쳤다, `useMenuBand` 참고), 그 덩이는 **아랫단 0x2524c 안에만** 있다. 윗단 판
 * 0x24b1c 에는 아예 없다. 그리고 멈추는 값은 **높이/2 = 160** 이다 — 폭/2 = 120 이 아니다.
 * 0x254e8 이 부르는 것이 폭(0x14008b8)이 아니라 **높이(0x14008c8)** 이기 때문이다.
 *
 * 각도 구간별 main_ui 이미지 0·1·2 칸 밑판 · 접힘 연출(R6 2절)은 `menuWheelSlotDrawOf` 가 옮겼다(2026-10-14).
 *
 * ## 아직 모르는 것
 * - main_ball 을 그리는 조건 `[+0xe6] ≥ 0` 의 뜻을 몰라 늘 그린다. **근사**.
 *   (진입 0x237b4 가 `[0xe6] = 0`, 0x23848 이 5·0x11 로 들어올 때만 `= 1` 을 넣는다. 0x24cde 가
 *    `[0xe6] ≤ 0` 이면 테두리 원·칸 글자를 통째로 건너뛰므로 뜻이 "바퀴를 편다" 쪽으로 보이는데,
 *    윗단 진입 0x25936 이 무엇을 넣는지까지는 안 봤다.)
 *
 * 그림 치수는 직접 읽어 확정이다:
 *   `main_ui/frames/NNN` 높이 **27** · `img_text/frames/NNN` 높이 **10**
 *   설명 판 `main_ui/003` 149×63
 */

/**
 * 원작 화면 240×320.
 *
 * ⚠️ **바이너리에 박힌 값이 아니다.** 초기화 0x237c4·0x237d6 이 `[메뉴+0xd8] = 폭>>1`,
 * `[메뉴+0xdc] = 높이` 를 넣는데, 그 폭·높이는 .data 0x14008b8 · 0x14008c8 **을 부른** 값이다.
 * 이 둘은 전역 변수가 아니라 .data(0x1400000, 크기 0x998, **실행 가능**) 에 깔린 **WIPI 네이티브
 * 호출 토막**이다 — 16바이트마다 `[클래스 0x1fb][메서드 번호][str lr,[sp,#-4]!][bl 디스패처]` 꼴이고
 * 폭이 메서드 0x32, 높이가 0x33 이다. 곧 **기종이 알려 주는 값**이라 기종별로 다를 수 있다.
 *   (`ldr r3,[pc,…] ; bl 0xca9f8` 의 0xca9f8 은 `bx r3` 한 줄짜리 징검다리다 — 0xca9e8~0xcaa20 이
 *    레지스터마다 `bx rN` 을 늘어놓은 표다. 그래서 "전역을 읽는다" 가 아니라 "그 주소로 뛴다" 다.)
 *
 * 그래도 **320 으로 본다** — 근거:
 * - `mainui/main_title.pzx` 안에 **정확히 240×320 인 그림이 10장** 있다(전체 배경). 240×400 이상은 없다.
 * - 외출 지도 바닥선 `0x7fe0c` = `높이() − 0x44` → 320 이면 252 (A-8·R6 5절과 같은 값),
 *   지도 프레임은 높이 298 이라 `mapY = (높이 − 298)>>1 = 11` — 400 화면이면 51 이 되어 그림이 뜬다.
 * - 훈련 팝업 가운데 정렬 `0x84eda` 의 `높이()/2` = 160.
 * - 0x1637d4 바이트 바이너리 전체에 해상도 분기가 없다(한 벌로 모든 기종을 돈다).
 * **단, 아래 `menuReelTextTopLeftOf`·`MENU_DESCRIPTION_PANEL` 의 잘림은 높이와 무관하다** — 그 주석 참고.
 */
export { MENU_LABEL_HEIGHT, MENU_WHEEL_ITEM_FRAMES, SCREEN_HEIGHT, SCREEN_WIDTH } from '@/pages/main-menu/lib/mainMenuLayout/menuScreen'
export {
  isMenuWheelAngleDrawn,
  MENU_WHEEL_ANGLES,
  MENU_WHEEL_CENTER,
  MENU_WHEEL_ORDER,
  MENU_WHEEL_RINGS,
  MENU_WHEEL_SELECTED_SLOT,
  MENU_WHEEL_TURN_TICKS,
  menuWheelAngleAt,
  menuWheelLabelTopLeftOf,
  menuWheelOrderOf,
  menuWheelPointOf,
  menuWheelRestingLabelsOf,
  menuWheelSlotDrawOf,
  menuWheelStepOf,
} from '@/pages/main-menu/lib/mainMenuLayout/menuWheel'
export type { MenuTurnDirection, MenuWheelUnderlay } from '@/pages/main-menu/lib/mainMenuLayout/menuWheel'
export {
  MENU_REEL_ITEM_COUNT,
  MENU_REEL_ITEM_FRAMES,
  MENU_REEL_ROW_STEP,
  MENU_REEL_SCROLL_STEPS,
  MENU_REEL_SHADOW_COLOR,
  MENU_REEL_SHADOW_OFFSET,
  MENU_REEL_SLOT_TABLE,
  MENU_REEL_SLOTS,
  MENU_REEL_TEXT_CENTER_X,
  menuReelEntryAtSlotOf,
  menuReelFrameListOf,
  menuReelOrderOf,
  menuReelSlotRowOf,
  menuReelTextTopLeftOf,
  rotateMenuReel,
} from '@/pages/main-menu/lib/mainMenuLayout/menuReel'
export {
  MENU_BAND_COLOR,
  MENU_BAND_FIRST_SPREAD,
  MENU_BAND_GROW_TICKS,
  MENU_BAND_LEFT,
  MENU_BAND_MAX_SPREAD,
  MENU_BAND_PIVOT_Y,
  MENU_BAND_RIGHT,
  menuBandAlphaAt,
  menuBandLinesOf,
  menuBandStateAt,
} from '@/pages/main-menu/lib/mainMenuLayout/menuBand'
export type { MenuBandState } from '@/pages/main-menu/lib/mainMenuLayout/menuBand'
export {
  MENU_DESCRIPTION_PANEL,
  MENU_DESCRIPTION_TEXT_BOX,
  MENU_PANEL_HEADING_COLOR,
  menuPanelHeadingFrameOf,
  menuPanelHeadingTopLeftOf,
  menuPanelLabelTopLeftOf,
} from '@/pages/main-menu/lib/mainMenuLayout/menuPanel'
export type {} from '@/pages/main-menu/lib/mainMenuLayout/menuPanel'
