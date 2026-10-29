/**
 * **마선수 등장 컷인 `0x473f0`** — 교체 연출 0x16 의 그리기 0x4da30 이 "CHANGE" 애니(`substitutionScene`)를 그린 뒤
 * `+0x195c` 비트 2(들어온 선수가 마선수)면 4dafa 에서 부른다 (2026-10-08 직접 뜸, R2 11절을 줄 단위로 다시 맞춤).
 *
 * 0x16 진입 0x3d458 이 단계 `[+0x196c]` 를 −1 로 두고, 그림마다 아래를 한 번 돈다(W = 240 · H = 320 · cx = W/2 · cy = H/2):
 * ```
 * 47442  fillRect(0, cy − 40, W, 82, RGB(50, 1, 1))                        ; 검붉은 띠 (0x6a9f1)
 * 4746a  창 객체 0x75b19(0x9c 바이트): 테두리 [+0x7c] = RGB(2, 2, 2) · 채우기 [+0x80] = RGB(172, 12, 5)
 * 474c0  번호 = 0xb63a1(들어온 선수) (+5 타자 — +0x195c 비트 0)
 * 474f0  단계 ≠ −1 이면 game_ui 프레임 0x55 + 단계 mod 5 를 (cx, cy − 39) 에 (0xba759 종류 1)     ; 속도선
 * 4752a  switch 단계 (표 0xd0130):
 *          −1  단계 = 0 · 속도 [+0x1970] = 1 · 초상 [+0x1978] = 0x63a05(ui, 0xd0108[번호], 0) · 0x93cfd(초상, 1) ; r = 80
 *           0  r = W/2 − 속도 ; 속도 ×= 4 ; r < 0 이면 r = −4 · 단계 = 1
 *         1·2  r = 0 ; 단계 + 1           3·4  단계 + 1 · 속도 = 1 ; r = 0          그 밖  r = 0
 * 475ea  배너 여덟 점 (0, cy−14) (cx+r+14, cy−14) (cx+r+40, cy−40) (W, cy−40) (W, cy+14) (cx−r−14, cy+14) (cx−r−40, cy+40) (0, cy+40)
 *        0x75ba5 · 0x75e31 — 스캔라인 채우기(0x75c70) 뒤 테두리(0x75dc4), 그리고 윗변 셋 · 아랫변 셋을 y + 1 에 검정 선(0x6a905)
 * 47706  단계 > 4 이면 game_ui 이미지 96 을 (cx + 5, cy − 39) · 95 를 (cx − 104, cy + 12) 에 효과 2(더하기) · 230
 * 47756  switch 단계 − 5 (표 0xd0148):
 *         5~9   흰 사선 넷 — 알파 단계·10 + 50, d = 단계·10 − 50: (cx+d−120, cy−14) (cx+d−66, cy−14) (cx+d−120, cy+40) (cx+d−174, cy+40) ; 단계 + 1
 *        10~13  흰 여덟 점 — 알파 0x8c, e = 단계·5 − 60: (cx+e−26, cy−14) (cx+14, cy−14) (cx+40, cy−40) (cx+e+80, cy−40)
 *               (cx+e+26, cy+14) (cx−14, cy+14) (cx−40, cy+40) (cx+e−80, cy+40) ; 단계 + 1
 *        14~18  흰 넷 — 알파 210 − 단계·5, f = cx + W/2 + 단계·12 − 162: (f−54, cy−40) (f, cy−40) (f−54, cy+14) (f−108, cy+14) ; 단계 + 1
 *        19~21  단계 + 1          22  0xbcb49(장면, 13) — 0x16 을 끝낸다(→ 0xd)
 * 47962  (늘린 뒤의) 단계 > 4 이면 초상: 단계 ≤ 7 이면 x = W − 단계·5 + 25, 아니면 x = W − (폭 / 2) − 5 (폭 = 지금 칸의 상자, 0x93e7d),
 *        y = cy + 13 에 0x93c45(초상, x, y) — 칸을 넘기는 0x93d91 은 안 부른다(첫 칸에 선다)
 * 479e0  (늘린 뒤의) 단계 5 → 이미지 93 을 (W/2 − 150, cy + 5) · 6 → (W/2 − 120) · 7 → (W/2 − 59) ·
 *        8~10 → 0xbb91d(이미지 93, W/2 − 40, cy + 5, 종류 8, 10, 200)(+200 밝게) · 그 밖 → (W/2 − 49)
 * ```
 * 곧 그림 0 에서 −1 → 0, 그림 1~4 에서 배너가 미끄러져 들어오고(r = 119 · 116 · 104 · 56), 그림 5 에서 r = −4 로 맞물린 뒤
 * 그림 9 부터 사선 · 초상 · "CHANGE" 글자(이미지 93)가 들어오고, 그림 26 이 단계 22 를 보고 13 을 보내 **27 그림**에 끝난다.
 *
 * 그리기 바탕(픽셀 단위로 옮긴다):
 * - 0x6a9f1 fillRect · 0x6a905 drawLine 은 색 윗바이트 알파가 0 · 0xff 가 아니면 반투명(0x1400698(ctx, 4, 알파))이다.
 *   RGB 0x1400748 은 윗바이트 0 이라 불투명이다.
 * - 0x75c70 스캔라인: y = 최소 y 부터 최대 y **앞까지**, 변 (i−1, i) 마다 `(yi < y ≤ yj) || (yj < y ≤ yi)` 이고 yi ≠ yj 면
 *   x = xi + (y − yi)(xj − xi) / (yj − yi)(0 쪽으로 자름), 정렬해 둘씩 [최소 x, 최대 x] 로 자른 뒤 가로선(채우기 색).
 * - 0x75dc4 테두리: 점 i 에서 다음 점으로 선(테두리 색) — 닫힌 다각형.
 * - 효과 2(0x9a2f1 · 팔레트 0x973c5): 채널마다 화면 + 그림·230 >> 8, 최대에서 자름.
 *
 * 하위 폴더 (`aceCutIn/`): `portrait`(인물 표 0xd0108 · 0xd0ae6) · `types` · `shapes`(띠 · 배너 · 사선 · 글자 자리) ·
 * `draws`(단계 기계 4752a · 47756) · `raster`(스캔라인 0x75c70 · 선)
 */
export { aceCutInPortraitOf, aceCutInSlotOf } from '@/features/play-game/model/aceCutIn/portrait'
export type { AceCutInDraw, CutInColor, CutInPoint, CutInPolygon } from '@/features/play-game/model/aceCutIn/types'
export { ACE_CUT_IN_DRAWS, aceCutInDraws } from '@/features/play-game/model/aceCutIn/draws'
export { linePixels, scanlineSpans } from '@/features/play-game/model/aceCutIn/raster'
