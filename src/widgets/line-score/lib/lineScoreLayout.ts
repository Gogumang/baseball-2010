/**
 * **이닝별 점수판 `0x41c18(장면, x, y)`** — 직접 떴다(0x41c18~0x420ca).
 *
 * 부르는 곳(xref 둘): 0x21 중계 그리기 0x4258c(4283a) — (W/2 − 폭/2, 10) = (14, 10) · 0x18 경기 끝 판 그리기 0x4fe9c(503d8) —
 * (W/2 − 폭/2, H − 높이 − 0xb) = (14, 252). 폭 · 높이 = game_ui 프레임 19 상자 4(212 · 57, `0x94a65(…, 0, 4)`).
 *
 * ```
 * 41c46  i0 = st[0x6b] − 8, 음수면 0                          ; 보이는 아홉 칸의 첫 이닝 (9회 넘으면 밀린다)
 * 41c5e  0x5461c(skin, x, y, 0xd6, 0x3b)                       ; 판 (아래 `panelRectsOf`)
 * 41c94  0xba0bd((x+0x17, y+0x14, 0xb5, 0x1e), 둥글기 1, RGB(0x12, 0x23, 0x52))
 * 41c9e  깜빡 = 0xb68fc(st)(경기 끝) ? ([장면+0x2c] mod 8 ≤ 4) : 1
 * 41cfa  game_ui([장면+0x1018]) 이미지 34 "R" 을 (x+0xba, y+8)
 * 41d1a  [장면+0x1054](team_logo_ini 그림[측 0 팀]) 을 (x+8, y+0x16) · [+0x1058](측 1) 을 (x+8, y+0x25)    ; 적재 0x48a38~0x48a74
 * 41d58  k = 0..8: 0x585ad(skin, num, 0x32, i0+k+1, x+0x21+17k, y+8, 0, 0, 2)                 ; 이닝 번호
 * 41dba  k = 0..8 (i = i0+k):  칸 (x+0x18+17k, y+0x15, 0x10, 0xe) 0xb9f75 RGB(0x1d, 0x35, 0x6e)
 *          i ≤ st[0x6b] 이면 0x585ad(…, 0, 0xb6989(st, i, 0), 칸x + 8, 칸y + 2, 0, 0, 2)          ; 측 0
 * 41e78  같은 칸을 y+0x24 에 — i < st[0x6b] 이거나 (i == st[0x6b] 이고 st[9] == 1) 이면 측 1 점수
 * 41f26  합 칸 (x+0xb1, y+0x15, 0x1b, 0xe) · (x+0xb1, y+0x24, …) 0xb9f75 같은 색
 * 41fb8  깜빡이 서 있으면 0xb69b0(st, 0/1) 을 (x+0xb1 + 13, 칸y + 2) 가운데                    ; 경기 끝이면 8틱에 5틱 보인다
 * 42040  경기 끝이 아니고 [장면+0x2c] mod 10 ≠ 0 이면 game_ui 이미지 33(노란 테)을
 *          (x+0x15 + 17·(st[0x6b] − i0), st[9] == 1 ? y+0x21 : y+0x12)                       ; 지금 칸 — 10틱에 한 번 꺼진다
 * ```
 * 0xb6989(st, i, s) = st[0x6c + (i mod 9)·2 + s] (s8) — 9칸을 돌려 쓴다(`MissionInningRuns`). 숫자 0x585ad 정렬 2 = x 에서 폭/2 를 뺀다
 * (`widgets/matchup-cards` 의 `paddedNumberGlyphsOf` 와 같은 함수 — 간격 0 · 자리 0).
 *
 * - 자리 · 색 · 그림 번호(`lineScoreConstants`) · 꼴(`lineScoreTypes`) · 판 0x5461c(`panelRects`)
 * - 숫자 · 깜빡(`lineScoreCells`) · 그림 자리 전부(`lineScorePlacement`)
 */

export { LINE_SCORE_AT, LINE_SCORE_IMAGES } from '@/widgets/line-score/lib/lineScoreLayout/lineScoreConstants'
export type { LineScoreGlyph, LineScoreState } from '@/widgets/line-score/lib/lineScoreLayout/lineScoreTypes'
export { panelRectsOf } from '@/widgets/line-score/lib/lineScoreLayout/panelRects'
export { centeredNumberGlyphsOf, isLineScoreTotalShown, isLineScoreCursorShown } from '@/widgets/line-score/lib/lineScoreLayout/lineScoreCells'
export { lineScorePlacementOf } from '@/widgets/line-score/lib/lineScoreLayout/lineScorePlacement'
