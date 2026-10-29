/**
 * **시즌 서브아이템 상점(0xdc 창 종류 1) · GP 상점(종류 2)** — 아이템 메뉴 0xd0 칸 2 · 칸 3 (들어옴 0x5f3c).
 * 직접 떴다: 키 0x957c(종류 1 0x97de~0x98a0 · 종류 2 0x98a8~0x9a82) · 적용 0x7d90(결과 0xc → 0x7f2a · 0xd → 0x7ff2) ·
 * 효과 0xa310c(점프표 0xd7d60).
 *
 * ```
 * 종류 1  k = 줄 × 5 + 열 (0xca7b5 · 0xca911)
 *         SR[0x58 + k] ≠ 0                       → StrMODE[78]
 *         p = 0xcbc94[k] ; p × 10 > SR+2 소지금     → StrMODE[77]
 *         StrMODE[79] (%s = 0x55cf5(p × 1000)) 예/아니오 — 결과 0xc
 *   0x7f2a 소지금 = clamp(소지금 − p × 10, 0, 9999) · SR[0x58 + k] = 1 · StrMODE[92](%s = 이름) · 저장
 * 종류 2  k > 6 이면 아무것도 안 한다. g = 0xcbbe3[k] × 100
 *         g > G(app+0x64)                         → StrMODE[65]
 *         k 5: SR+0x56 ≠ 1 → [176] · k 1: 사기 == 100 → [91] · k 4: SR+0x54 > 98 → [210]
 *         k 2: SR+5 == 0 → [208] · k 6: SR+0x55 > 0 → [217]
 *         StrMODE[82] (%d = g) — k 4 만 앞에 [224] + "!N" + "!N" — 예/아니오, 결과 0xd
 *   0x7ff2 k 3 → 상태 0xe8 (G 는 거기서 뺀다, `SEASON_STAMINA_ITEM`)
 *          그 밖: G = clamp(G − g, 0, 99999) · 0x22c29(3, g) · 효과 0xa310c · 0x22e35(2, k) · 저장 · 팝업
 * ```
 *
 * 공개 이름 모음 — 하위 폴더 (`seasonItemShop/`): `prices`(값 표 0xcbc94 · 0xcbbe3 · 글 번호 · 만원 서식 0x55cf5) ·
 * `subItemShop`(종류 1 가드 · 적용 0x7f2a) · `gpItemShop`(종류 2 가드) · `gpItemEffect`(효과 0xa310c · 복권 0xd7cea)
 */
export {
  FULL_PITCHER_STAMINA,
  SEASON_SHOP_TEXT,
  SEASON_STAMINA_ITEM,
  seasonGamePointAfter,
  seasonGpItemPriceOf,
  seasonShopTextOf,
} from '@/entities/season-mode/model/seasonItemShop/prices'
export { applySeasonSubItem, checkSeasonSubItem } from '@/entities/season-mode/model/seasonItemShop/subItemShop'
export { checkSeasonGpItem } from '@/entities/season-mode/model/seasonItemShop/gpItemShop'
export { applySeasonGpItem } from '@/entities/season-mode/model/seasonItemShop/gpItemEffect'
