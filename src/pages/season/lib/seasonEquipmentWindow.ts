/**
 * **시즌 장비 창 0xdc · 창 종류 3** 의 그림 — 그리기 0xb1f8 b296~b346 (직접 떴다, 0x83378 은 에뮬레이터로 그리기 호출을 맞춰 봤다):
 * ```
 * 0xb1f8   [this+0x88] 메뉴 칸 ≠ 1 이고 [창+0x1a4] == 3 이면  0x8453c(창, 틱) → 0x83378 · 카드 0x7ba44 · 선수 그림(0xd9 와 같다) · 머리띠 0x7f4ec
 *          (상태판 · 커맨드 줄은 그리지 않는다)
 * 0x83378  프레임 = mode_ui (0x7b970 모드 4 ? 30 : 31) — 시즌은 늘 31(투수 쪽 부위 아이콘, 타자여도 — 원본 그대로)
 *   판   0x7c110(창, 박스 6, 1)                                   ; `tabPanelRectsOf`
 *   박스 0 (h − 2) 네 칸: 세로선 (x, y)~(x, y + h) #4A7BDE · x + 1 #29318C, x += w + 2
 *   박스 4 설명 상자: 윗선 #18244A · 채움 (x, y + 1, w, h − 6) #1D44A8 · 왼선 (x, y)~(x, y + h) #18244A ·
 *         오른선 (x + w − 1, y + 1)~(…, y + h − 6) #4A7DDE · 깎인 귀 다섯 줄 · 밑선 #4A7DDE  ; `descriptionBoxRectsOf`
 *   프레임 그림 vt+0x10(프레임, 0, 0)
 *   박스 1 세 줄 (y += h + 2): img_text 302 소지금 · 303 가격 · 333 효과 — 정렬 0x24 · ox −2
 *   박스 2 줄 0: 소지금 0x63331(SR+2 × 100 만원, 정렬 0x24, ox −2)
 *   부위 표시 mode_ui 51 을 (박스 0 x + 2 + 부위 × (w + 2), y, w, h) 가운데 — 칸 목록이 아니면 틱 % 10 == 0 에 끈다
 *   줄 i = 맨 윗줄 … +4 (칸 수 [창+0x1b0] = 11 까지), 박스 3 에서 y += h + 2:
 *     글색 (0x87, 0xf8, 0xff) · 그 선수의 진짜 니블 − 1 == 칸 이면 mode_ui 44 막대 + 글색 (0xce, 0xc7, 0xbd)
 *     칸 > 6 이고 0x9f69d(app, 타자?, 부위, 칸 − 7) == 0 이면 "????"(0xd4c18), 아니면 StrITEM 이름 — 칸 가운데(0x22)
 *     칸 목록 [창+0x1a8] 이고 커서 줄이면: 틱 % 10 ≠ 0 에 노랑 테두리 0xb9ed5 · 글색 노랑(255, 255, 0) 으로
 *       박스 2 줄 1 가격 0x63331(0xd4510[11 × 부위 + 칸 (+44 타자)] × 1000 만원, 0x24, −2)
 *       박스 2 줄 2 효과 — d = 0x6c805(v, 10)(자릿수 − 1), v = 0xd41ae[칸]:
 *         img_text (타자 336 · 투수 340) + 부위 를 0x24 · ox −(7d + 19) · num 105 "+" 를 0x24 · ox −(7d + 10) · oy 1 ·
 *         숫자 0xba719(자간 1, v, num 20, 0x24, ox −2)
 *       박스 4 설명 (0xba411 정렬 0x11, 안쪽 5 · 5):
 *         칸 > 6 — 잠겼으면 StrITEM[(타자 202 · 투수 186) + 4 × 부위 + 칸 − 7] 힌트, 열렸으면 아무것도 없다
 *         칸 ≤ 6 — 0xd44ae[칸] == 0 이면 StrITEM[184] "인기도 제한 없음", 아니면 StrITEM[185] "인기도 %d 이상"
 *   박스 5 굴림 막대: 바탕 #102152 · 칸 수 ≤ 5 면 통째, 아니면 높이 t = (5h + 칸수 − 1) / 칸수 · 자리 (윗줄 × h) / 칸수 —
 *         흰 (x + 1, y + p, w − 2, t − 1) · #1D44A8 (x + 2, y + p + 1, w − 4, t − 3)
 * ```
 * 목록 두 개(0x81618 종류 3): 부위 [창+0x198] = 4 열 × 1 줄, 칸 [창+0x19c] = 1 열 × 11 줄 · 보이는 줄 [+0x38] = 5 — 둘 다 깃발 0x30(끝에서 감는다).
 */

export {
  EQUIPMENT_COLORS,
  EQUIPMENT_WINDOW,
  centeredOffsetOf,
  isBlinkOn,
  partMarkerBoxOf,
  windowRowOf,
  type WindowBox,
  type WindowRect,
} from './seasonEquipmentWindow/layout'
export { descriptionBoxRectsOf, partSeparatorRectsOf, scrollThumbRectsOf, tabPanelRectsOf } from './seasonEquipmentWindow/windowRects'
export { moveEquipmentLevel, moveEquipmentPart, scrolledEquipmentTopOf } from './seasonEquipmentWindow/levelCursor'
export {
  LOCKED_ITEM_NAME,
  divisionsOf,
  effectOffsetsOf,
  equipmentDescriptionOf,
  equipmentEffectBonusOf,
  equipmentItemNameOf,
  equipmentPriceTenThousandsOf,
} from './seasonEquipmentWindow/itemText'
