/**
 * **투수·타자 소개 판 — 원본 `0x44944` (직접 떴다, 0x44944~0x45786)**.
 *
 * 경기 상태 0xe(투수 등판·확인)의 그리기 `0x4d9ec` 는 0xd 그리기 `0x4db2c` 와 같은 여섯 함수
 * (0x38d1c · 0x49e64 · 0x35b94 · 0xbe6a0 · 0x42f2c · 0x4c4bc)를 부른 뒤 **이 함수 하나**를 더 부른다(0x4da20).
 * 0x44944 를 부르는 곳은 0x4d9ec 하나뿐이고 안에 모드(+0x1104) 검사가 없다 — **모든 모드의 상태 0xe** 가 같은 판을 그린다.
 * 그리는 것은 판 두 장이고, 문자열 표(Str*)의 문구는 하나도 없다 — 글은 선수 이름(0xb62c0)뿐, 나머지는 그림 글자다.
 *
 * ```
 * 밀림   a0 = 틱 == 0 ? 90 : 110 · a1 = min(틱 × 16, 110) · S(a) = (0x6c7c0 sin×65535(a) × 0x8c) >> 16
 *        o = S(a0) − S(a1)                           ; 틱 0·1·2·… → 139·93·57·27·6·−6·−8·0·0…  (살짝 넘쳤다 돌아온다)
 * 손     h = 0xb63c0(지금 타자 0xae89c([장면+0x220]))   ; 1 좌타 · 0 우타
 *        투수 판 기준 = h ? W + o − 0x8c : −o · 타자 판 기준 = h ? −o : W + o − 0x8c
 * 쪽     s = (s8)장면+0x17e1 (적재 8 이 0xb63c0(모드 타자)로 넣는다, 0x4887e) — s > 0 이면 투수 +5·타자 −3, 아니면 투수 −3·타자 +3
 * 투수 판 (game_ui 프레임 1, 위 = H − 0xe6)          타자 판 (game_ui 프레임 2, 위 = H − 0x5f)
 *   박스 0 둥글기 5 검정 · (+1,+1,−2,−2) #335FCD   ; 0xba0bc (두 판 같다)
 *   프레임을 (x, y) 에 두 번 (0xba19c — 그림이 불투명이라 한 번과 같다)
 *   박스 1  img_text 157 PLAYER / 158 COM (0xb6c20(st, st[0xa]) == 1 → COM) · 색 4 · 정렬 0x11
 *   박스 3  이름 0xb62c0 · 흰색 · 정렬 0x24 (0xba4c0)
 *   박스 7  보직 0x545e8(0xb6704 = +0xb & 3): 0 선발 → game_ui 4 + img_text 49 · 1 중계 → 7 + 170 · 2 구원 → 5 + 182
 *   박스 8  0xb63c0(투수) ? 54 좌완 : 55 우완
 *   박스 4  316 "방어" · 박스 11 방어율 정수 · 박스 10 소수 두 자리 · 점 (박스11 오른끝 + 1, 아래 − 3, 1×2) 흰색
 *   박스 5  317 "삼진" · 박스 6 탈삼진 (+0x26, 자간 1)
 *   박스 9  체력 막대 (`staminaGaugeRectsOf`)
 *                                                    박스 1  PLAYER / COM (st[9])
 *                                                    박스 2  타순 +0x32 + 1 (num 30~, 자간 1, 정렬 2)
 *                                                    박스 3  이름 · 박스 7 수비 0x54590(+0x1c & 0xf) (글자 y + 1)
 *                                                    박스 8  56 좌타 / 57 우타 · 박스 4 318 "타율" · 박스 11 타율 · 점
 *                                                    박스 5  180 "홈런" · 박스 6 홈런(+0x28) · 박스 10 319 "타점" · 박스 9 타점(+0x2a)
 *                                                    판 아래 오늘 타석 기록 마지막 4칸 (`recentResultChipsOf`)
 * ```
 * 박스는 `public/sprites/game_ui/frames/boxes.json`("001"·"002"), 그림 크기는 각 `origins.json` 그대로다.
 * 숫자 글자는 num.pzx 그림 20~29(주황, 6×10 · "1" 만 4×10)와 30~39(타순)다.
 */

export { PITCHER_CARD_TOP, BATTER_CARD_TOP, PITCHER_BOXES, BATTER_BOXES } from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardBoxes'
export type { CardBox } from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardBoxes'
export {
  GAME_UI_FOLDER,
  IMG_TEXT_FOLDER,
  NUM_FOLDER,
  PITCHER_CARD_FRAME,
  BATTER_CARD_FRAME,
  GAME_UI_FRAMES,
  IMG_TEXT_FRAMES,
  numImageWidthOf,
  LABEL,
  CARD_COLORS,
  NUMBER_BASE,
} from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardFrames'
export type { FrameSize } from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardFrames'
export { slideOffsetAt, cardOriginsAt, framePlacementOf } from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardPlacement'
export type { Placed } from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardPlacement'
export {
  boxNumberGlyphsOf,
  paddedNumberGlyphsOf,
  earnedRunAverageGlyphsOf,
  battingAverageGlyphsOf,
} from '@/widgets/matchup-cards/lib/matchupCardsLayout/numberGlyphs'
export type { NumberGlyph } from '@/widgets/matchup-cards/lib/matchupCardsLayout/numberGlyphs'
export { roundFillRectsOf, cardBackgroundOf, staminaGaugeRectsOf } from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardRects'
export type { FillRect, StaminaGauge } from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardRects'
export { pitcherRoleBadgeOf, batterPositionBadgeOf, recentResultChipsOf } from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardBadges'
