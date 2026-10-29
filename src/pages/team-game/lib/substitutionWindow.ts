/**
 * **교체 창 — 경기 상태 0xb** (진입 0x3ae08 · 키 0x495fc · 그리기 0x4db68 → 0x384b8). 2026-10-14 unicorn 으로 0x384b8 · 0x37904 ·
 * 0x37e5c · 0x37dd4 · 0x571d8 · 0x5b798 · 0x5aefc 를 그대로 돌려 그리기 인자를 받았다(240×320).
 * ```
 * 0x384b8
 *   공용 판 0x55e61(skin, W/2, H/2, 192, 210, 0, 0x22, 위 띠 16, 아래 띠 0, 제목 탭 1, 어둡게 1)      → (24, 55)
 *   game_ui 이미지 50 ▲ (W/2 − 6, H/2 − 115) · 51 ▼ (W/2 − 6, H/2 + 107) — 틱 [장면+0x2c] % 8 ≤ 3 이면 2px 바깥(43 · 269)
 *   사람 팀 큰 로고(장면 +0x104c 측 0 · +0x1050 측 1 — st[0x31] == 0 이면 측 0) 0xbb91d(로고, W/2 − w·15/20, H/2 − h·15/20 + 35,
 *     종류 0x12(2 크기 · 0x10 섞기), 15, 25) — 1.5 배 · 섞기 0xbb8d4(그림 × (32 − 25) + 바탕 × 25) / 32
 *   제목 img_text 150 "투수"(투수 교체) · 149 "타자"(대타)를 팔레트 3 으로 (41, 60), 팔레트 0 으로 299 "교체" 를 (65, 60)
 *   지금 선수 칸 0x37904(장면, 29, 74, 투수?) · "CHANGE" game_ui 애니 0(프레임 41~43, 지연 4, 돌림)을 (50, 122)
 *   벤치 목록 0x37e5c(장면, 29, 154, 투수?) — 6 줄 · 커서 상자 0x37dd4 · 상세 창 0x5b798
 *   game_ui 이미지 12(41×12)를 (W/2 − 20, H − 13) · img_text 프레임 167 "0 INFO" 를 (W/2 − 15, H − 10)
 * ```
 * 칸 배치(0x37904 · 0x37e5c): 칸 x = 29 + 6 = 35 에서 칸마다 폭 + 3 — 이름 54(game_ui 28) · 나머지 36(game_ui 35).
 * 머리 0x5650c 는 game_ui 24 · 34 의 크기로 0xb9d74(글, x, y − 2, w, 15, 0x22, …, dy [sp+0x14] = 2) — 곧 (x, y, w, 15) 안 가운데에
 * img_text 표 0xcfe7e (투수 27 이름 · 28 보직 · 171 방어 · 181 삼진 / 타자 27 · 28 · 172 타율 · 61 홈런)를 팔레트 0 으로 그린다.
 * 0x37904(장면, 29, 74) 는 머리 y = 74 + 3 = 77 을 넘긴다(0x3795a · 0x37994). 값 줄은 머리 + 15 + 3 = 95.
 * (r99: 예전 75 는 0xb9d74 의 y − 2 를 받고 dy 2 를 빠뜨렸다 — 나리 기록실 124 r89 고침과 같은 것)
 * 벤치 줄은 154 에서 18 씩.
 */
export { SUBSTITUTION_WINDOW, HEADER_TEXT_FRAMES, isBlinkOut, cursorBoxOf, changeFrameAt, movedListCursor } from './substitutionWindow/windowLayout'
export { FIELDER_TYPE_COLORS, staminaLinesOf, substitutionRowsOf } from './substitutionWindow/substitutionRows'
export type { SubstitutionRow } from './substitutionWindow/substitutionRows'
export { playerDetailOf } from './substitutionWindow/playerDetail'

export { roundEdgeRectsOf } from '@/widgets/player-detail-window/lib/playerDetailWindow'
/* ── 상세 창 0x5b798 ('0' INFO) — 엔트리 목록 창과 같이 쓴다 (`widgets/player-detail-window`) ─────────────── */
export { DETAIL_RADAR_AXES, detailWindowFrameAt, salaryTextOf, specialSwingTextOf } from '@/widgets/player-detail-window/lib/playerDetailWindow'
export type { PlayerDetail } from '@/widgets/player-detail-window/lib/playerDetailWindow'
