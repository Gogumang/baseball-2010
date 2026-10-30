/**
 * 경기진행 설정 창의 배치 — 그리기 **0x6042c** 를 직접 떴다(2026-10-14, 메인 eb368bf).
 *
 * 0x6042c 를 capstone 으로 읽고, unicorn 으로 그 함수만 돌려(그림·글·숫자·칸 호출을 가로채) 상태마다 인자를 받아 적었다.
 * W = 240 · H = 320 · y0 = 판 위쪽. 그림 상자(0xba815)의 폭 w 는 `asr` 반올림이라 `w >> 1` 이다.
 * ```
 * 6042c  [skin+0x2ba] == 0 이면 곧장 끝 (61c40) · [skin+0x40c] += 1 · 깜빡 = (그 값 % 8) ≤ 4  ; [sp+0xa0]
 * 604d2  단계 [skin+0x2bb] == 0 → 종류 고르기, 아니면 6074c 가 종류 [skin+0x2bc] 로 갈린다 (0 607b4 · 1 60ae8 · 2 60e58)
 *
 * ── 종류 고르기 · 찬스 · 이닝 (판 0x55e60(skin, W/2, H/2, 192, 160, 0, 0x22) → (24, 80, 192, 160))
 *        제목 img_text 357 "경기설정" 팔레트 3 을 (W/2 − 0x60 − w/2 + 0x2d, H/2 − 0x4b) = (69 − w/2, 85)
 *   종류 줄 k(0~2): slt_frame 프레임 15(101×18) (W/2 − w/2, H/2 − 0x32 + 26k) = (70, 110 + 26k)
 *                   img_text 표 0xd1c70[k] = 399~401 팔레트 0 을 (W/2 − w/2, 114 + 26k)
 *        깜빡이면 0x6aa64(70, 110 + 26·종류, 100, 17, 둥글기 1, RGB(255,255,85))
 *   찬스·이닝: 꼬리 탭 slt_frame 이미지 40(91×15) 을 효과 0x11(좌우 뒤집기) 로 (W/2 − w + 0x5b, H/2 − 0x4a) = (120, 86),
 *              그 위 img_text 402 "찬스" / 403 "이닝" 팔레트 1 을 (W/2 − w(91) + 0x82, H/2 − 0x48) = (159, 88)
 *   찬스: popup 프레임 19(방망이) (W/2 − 0x42, H/2 − 0x28) = (54, 120) · 20(글러브) (W/2 + 0x1f, 120) = (151, 120)
 *         img_text 352 "공격" (W/2 − 0x3c, H/2 + 2) = (60, 162) · 338 "수비" (W/2 + 0x25, 162) = (157, 162)
 *         깜빡이면 값 0 → 프레임 21 을 (54, 120) · 값 1 → 프레임 22 를 (151, 120)
 *   이닝: 종류 줄과 같은 자리에 img_text 표 0xd1c90 = 404~406, 커서도 같은 꼴(값 줄)
 *   설명: 칸 0xbb28c(W/2, H/2 + 0x23, 182, 40, 2) → (29, 195, 182, 40),
 *         글 0xba268(글, W/2 − 0x60, H/2 + 0x2a, 192, −1) = (24, 202, 폭 192) — 종류 0xd1c7c[종류] · 찬스 0xd1c88[값] · 이닝 0xd1c9c[값]
 *
 * ── 상세 (판 0x55e60(skin, W/2, H/2, 192, 212, 0, 0x22) → (24, 54, 192, 212), y0 = 54)
 *        제목 357 팔레트 3 (69 − w/2, H/2 − 0x65) = (49, 59) · 꼬리 탭 이미지 40 (120, y0 + 6) · img_text 353 "상세" 팔레트 1 (159, y0 + 8)
 *        화살 slt_frame 이미지 32 (W/2 − 6, y0 − 깜빡2 − 10) · 33 (W/2 − 6, y0 + 깜빡2 + 0xd6)   ; 깜빡2 = 깜빡 ? 2 : 0
 *   줄 Y = 88 · 127 · 147 · 187 (y0 + 0x22 에서 +0x27 · +20 · +40)
 *        네모 slt_frame 이미지 (지금 줄 ? 38 : 39) (35, Y − 2) · 이름 두 장 img_text 팔레트 0 (45, Y − 3) · (67, Y − 3)
 *          0 [149 "타자", 354 "조작"] · 1 [352 "공격", 355 "주자"] · 2 [150 "투수", 354] · 3 [338 "수비", 355]
 *   줄 0 · 2 (9칸): slt_frame 프레임 (켜짐 ? 49 : 48)(19×15) 을 (29 + 20i, Y + 11)
 *   줄 1 · 3 (3칸): slt_frame 프레임 (켜짐 ? 51 : 50)(33×15) 을 (107 + 34i, Y − 6)
 *        숫자 0x585ac(num 이미지 90 + 숫자, 칸x + w/2 (+ 주자 줄은 −3), 칸y + h/2 + 1, 정렬 0x22, 효과 0xb 단색)
 *          — 켜짐 흰색 · 꺼짐 RGB(142,148,193)
 *        주자 줄은 img_text 390 "루" 를 (칸x + w/2 + 2, 칸y + 3) — 켜짐 팔레트 0 · 꺼짐 팔레트 4
 *        켜진 칸은 0x6aa64(칸x, 칸y, w − 1, h − 1, 1, RGB(128,255,255)) — 단 (지금 줄 · 지금 칸) 은 건너뛴다
 *        지금 줄이고 깜빡이면 지금 칸에 0x6aa64(…, RGB(255,255,85))
 *   설명: 칸 0xbb28c(W/2, H/2 + 0x27, 182, 40, 2) → (29, 199, 182, 40) ·
 *         줄 ≠ 4 이면 글 0xba268(StrMAINMENU[121 + 줄]([skin+0x2a4] 0x702b5), W/2 − 0x56, H/2 + 0x2e, 172, −1) = (34, 206, 폭 172)
 *   확인: popup 프레임 (줄 == 4 ? 18 : 0) 을 (W/2 − w(프레임 0 = 41)/2, y0 + 190) = (100, 244) — 깜빡이지 않는다
 * ```
 * 깜빡 카운터 [skin+0x40c] 의 시작 값 — 확정(r166): 스킨은 앱에 하나([0x1552cfc] — 메인 메뉴 [this+0x120] · 시즌 [this+0xa8] 가 같은 객체)라
 * 창 열기 0x5fef4 · 0x5ffcc 는 이 칸을 안 건드리고 앞 화면이 남긴 값(엔트리 편집기 0x5561c 의 0 · 키 0x55864 · 순위 판 키 0x5787c ·
 * 명전 몸 그림 0x5e8bc 가 올린 값)에서 잇는다 — `shared/lib/skinStepCounter`.
 * 판 0x55e60 은 공용 `CommonPanel` 이 그린다 — 네 자리 모두 (…, 0, 0x22, 0, 0, 제목 탭 1, 어둡게 1).
 */
export {
  backButtonOf,
  centeredLeftOf,
  CHANCE_SLOT_SIZE,
  CHANCE_SLOTS,
  DESCRIPTION_BOX_COLORS,
  DETAIL_DESCRIPTION,
  DETAIL_WINDOW,
  IMG_TEXT_PALETTE,
  LIST_ROW,
  listCursorOf,
  listRowTopOf,
  OUTLINE_COLOR,
  SMALL_DESCRIPTION,
  SMALL_WINDOW,
  TAB,
  TAB_LABEL_FRAMES,
  TITLE,
} from '@/pages/match-settings/lib/matchSettingsLayout/settingsWindow'
export type { DescriptionLayout, RoundOutline, SettingsBox } from '@/pages/match-settings/lib/matchSettingsLayout/settingsWindow'
export {
  BASE_LABEL_FRAME,
  baseLabelPointOf,
  DESCRIPTION_LINE_HEIGHT,
  DETAIL_ARROWS,
  DETAIL_CELL_SHAPES,
  DETAIL_LABEL,
  DETAIL_LABEL_FRAMES,
  DETAIL_MARK,
  DETAIL_NUMBER,
  DETAIL_NUMBER_COLOR,
  DETAIL_OK,
  DETAIL_ROW_Y,
  detailCellBoxOf,
  detailCellOutlineOf,
  detailDigitWidthOf,
  detailDownArrowYOf,
  detailNumberCenterOf,
  detailUpArrowYOf,
  isSettingsBlinkOn,
} from '@/pages/match-settings/lib/matchSettingsLayout/settingsDetail'
