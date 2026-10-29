/**
 * **팀경기 정산 판** — 경기 상태 0x19 그리기 `0x4a384` 의 "그 밖 모드"(5·6 이 아닌) 갈래 `0x4a948` · 키 `0x407f0` (직접 떴다).
 *
 * ## 그리기 0x4a384 (W = 240 · H = 320)
 * ```
 * 4a38a  0x457cc · 4a3be 구름 0x78448 · 4a3ce 배경 0x40ff0(장면, +0x17e2)                ; `settlementBackdrop`
 * 4a3d2  이겼나 sp+0x98: 상태 [+0x1c] == 0x20 이면 0, 모드 5·6 이면 [미션+0xbc], 아니면 0x4a350 (0xb6c21(경기, 0xb6a0d) == 0)
 * 4a404  ── 진 판(sp+0x98 == 0) 갈래 ──
 *        [0x15605d0] 색 덮기(0, 0, W, H, 0x1400748(0,0,0), 단계 8)                       ; 검정 9/16 (`stepCover`)
 * 4a448  ── 이긴 판도 여기서 합친다 ──
 *        0x901a1([0x1400064], 0, 0) · fillRect(0, 40, W, 30, 0x80304EA2)                  ; 반투명 파란 띠
 * 4a48e  game_ui 프레임 8 (171×25) 을 (W/2 − 폭/2, 35)                                     ; = (34, 35)
 * 4a4d2  result 프레임 이겼으면 0 "YOU WIN" · 아니면 1 "YOU LOSE" 를 (W/2, 50)
 * 4a562  모드 5·6 이면 0x4a576(미션 판 — 이 파일 밖), 아니면 4a948:
 * 4a97a  0x41440(장면, W/2 − 120, H/2 − 80, 0, 0, 0)                                       ; 점수판 틀 (`widgets/scoreboard-frame`)
 * 4a980  점수 0xb69b0(st, 0) · (st, 1) → 0xba689(x, y = H/2 − 80 + 칸4.y + 칸4.h + 10, 0, 값, num 70 + 자리, 정렬 0x12)
 *        x = W/2 − 120 + 칸.x + 칸.w/2 + 2 (칸 4) · W/2 + 칸.x + 칸.w/2 − 0x76 (칸 5) — 칸 = game_ui 프레임 16 의 박스 4·5
 *        정렬 0x12 의 비트 2 는 0xba51c 에서 x += (0 − 글폭)/2 → **x 가 글 가운데**, 위 = y
 * 4aa5e  [장면+0x17e8] == 0 이면 아래 "기본 화면"(4af50), 아니면 "기록 판":
 * ```
 * ### 기본 화면 4af50 (+0x17e8 == 0)
 * ```
 * game_ui 이미지 12 (41×12) 를 (W/2 − 폭/2, H − 높이 − 1)                                   ; = (100, 307)
 * img_text 프레임 167 "0:INFO" (31×5) 를 (W/2 − 폭/2, H − 12 + 2)                            ; = (105, 310)
 * [+0x17f4](이번에 번 G) > 0 이면 0x54a61(skin, 값, W/2 − 0x28, H − 12 − 0x13, 0x46, 0, 1, 2, 1, 1)
 * ```
 * ### 기록 판 (+0x17e8 ≠ 0) — 판 높이 h = 182, 대전모드(8·9)에서 이겼으면 202 (sp+0x64 = 1)
 * ```
 * 0x55e61(skin, W/2, H/2, 176, h, 0, 0x22, 위 띠 0x10, 0, 0, 0) — 가운데 창, r7 = H/2 − h/2   ; 4aae0~4aafe 직접 뜸
 * game_ui 이미지 30 "RESULT" (W/2 − 폭/2, r7 + 7)
 * 칸 0xbb28d(W/2, r7 + 0x17, 162, 0x55, 2) ; r7 += 0x13
 * 기록 수 [+0x17f8] > 0:  r7 −= 6
 *   0x58c11(…, skin, slt_frame 이미지 78, W/2 + 0x44, r7 + 0x15, 1) → 보이는 줄 [윗줄, 끝)   ; 스크롤 0x61c55(skin, 0x3a, 4, 개수)
 *   줄 i (k = i − 윗줄), y = r7 + 16k + 0x16:
 *     StrGAME[[+0x17ec][i] + 8] 흰 글 (W/2 − 0x51 + 0xf, y)
 *     "!R%d회"(0xd0970) ← [+0x17f0][i] 흰 글 (W/2 − 0x51 + 0x14, y, 폭 0x7a) — 오른쪽 맞춤
 *   r7 += 6
 * 기록 수 == 0:  "!C기록이 없습니다!"(0xd0978) 흰 글 (W/2 − 0x51, r7 + 0x28, 폭 162)
 * r7 += 0x5d ; 칸 0xbb28d(W/2, r7, 162, 0x2e, 2)
 *   img_text 256 "획득" (W/2 − 0x51 + 0xf, r7 + 8) · 252 "GP" (W/2 − 0x51 + 0x2c, r7 + 8)
 *   0x54a61(skin, [+0x17f4], W/2 − 0x51 + 0x46, r7 + 5, 0x50, 0x10, 1, 1, 1, 0)
 *   img_text 257 "보유" (…, r7 + 0x1c) · 252 "GP" · 0x54a61(skin, [app+0x64], …, r7 + 0x19, 0x50, 0x10, 1, 1, 0, 0)
 * r7 += 0x32
 * sp+0x64(대전모드 이김)이면:  글 = "승리 추가 보상[!cffff00"(0xd060c) + v + " G포인트!cffffff]"(0xd0624)
 *   v = 모드 8 이면 s16 [app+0x112], 아니면 s16 [app+0x138]          ; 서버에서 받는 값으로 보인다 (🌐, R14 4-1 미해결)
 *   칸 0xbb28d(W/2, r7, 162, 0x12, 2) · **흐르는 글 0x5a8c8(skin, 글, W/2 − 0x51, r7 + 3, 162, 18, 1, 1, 1)** (0x4aef0)
 *   r7 += 0x14
 * popup 프레임 0 "OK" 를 (W/2 − 폭/2, r7)
 * ```
 * 기록 줄은 진입 0x4ea0c 가 채운다(4eb6c~4ec4a): 기록 k = 0..39 의 이번 경기 횟수가 0 이 아니면 차례대로 [+0x17ec] 에 k,
 * [+0x17f0] 에 횟수를 넣고 [+0x17f8] = 개수 · 0x61c55(skin, 0x3a, 4, 개수) · [+0x17e8] = 0.
 *
 * ## 키 0x407f0 (모드 5·6 이 아닐 때 0x40948)
 * ```
 * [+0x17e8] == 0:  '0'(0x30) → [+0x17e8] = 1 (기록 판을 연다)
 *                  그 밖 키 → [+0x17ec]·[+0x17f0] 을 풀고 메시지 0x3f3 (정산을 나간다)
 * [+0x17e8] ≠ 0:   0x61ce5(skin, 키) — 기록 줄 스크롤, 그 뒤 OK(−5)·CLR(−16)·'0'·'5' 면 [+0x17e8] = 0 (판을 닫는다)
 * ```
 */
export {
  SETTLEMENT_BAND,
  SETTLEMENT_INFO_BAR,
  SETTLEMENT_INFO_POINT,
  SETTLEMENT_LOSE_DIM_STEP,
  SETTLEMENT_RESULT_SPRITE,
  SETTLEMENT_SCORE,
  SETTLEMENT_TITLE_BAR,
  settlementPanelHeightOf,
  settlementPanelLayoutOf,
} from './settlementBoard/panelLayout'
export { VERSUS_WIN_POPUP_TICK, isVersusMode, versusWinPopupTextOf, type VersusWinReward } from './settlementBoard/versusReward'
export { NO_RECORD_TEXT, recordCountTextOf, settlementRecordRowsOf, versusRewardTextOf } from './settlementBoard/recordRows'
export { SETTLEMENT_SCROLL_TRACK, SETTLEMENT_VISIBLE_ROWS, scrollSettlementRecords, startSettlementScroll } from './settlementBoard/recordScroll'
export { settlementKeyActionOf } from './settlementBoard/settlementKeys'
