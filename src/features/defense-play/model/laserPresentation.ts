/**
 * **레이저 송구 연출의 그림 둘** — 연출 0x4403c 단계 1 의 줌 펀치(0xbb39d → 0xbb84c → 0xbb43c)와, 단계 3 이 세운 +0x1998 을 결과 판
 * 0x46844 가 보고 그리는 **큰 OUT**(game_judge 애니 2) (2026-10-08 직접 뜸).
 *
 * ## 줌 펀치 — 전역 0x15606d8
 * ```
 * 44146  단계 1: 0xbb39d(100, H.x, H.z − H.y, 1, 0)          ; H = 0xb0c91(플레이) 공 가진 야수의 +0x20(x, y, z)
 * bb39c  [0] = 1 · [1] = 1(커지는 중) · [4] = 100 · [8] = +5 · [0x14] = x·620/40000 · [0x18] = (z − y)/65   ; 바탕 그림 좌표
 * 46e24  그리기마다(0x46c88, 0x4403c 뒤): 0xbb84c([+0xfec], [+0xff0], −1, −1)   ; 화면 오프셋 · 중심은 [0x14] · [0x18]
 * bb84c  [0] 이면: 커지는 중 → 0xbb3f4 로 다시 적고 [4] += [8], [4] > 109 면 [4] = 110 · [1] = 0 ; [0xc] = **110**
 *               줄어드는 중 → [4] += [8](−5), [4] ≤ 100 이면 [4] = 100 · [0] = 0 ; [0xc] = [4]
 *        0xbb43c(오프셋 x, y, [0xc], [0x14], [0x18])
 * bb43c  srcW = W·100/s · srcH = H·100/s ; srcX = cx + 오프셋x − srcW/2 (0 ~ W − srcW 로 자름) · srcY 도 같다 ;
 *        그 사각형을 화면 전체로 늘려 덮는다
 * ```
 * 곧 그린 그림은 110 · 110 · 105 · 100% 네 그림이다(늘리는 단계의 [0xc] 가 늘 110 이라 105 를 건너뛴다).
 * 0xbb84c 는 결과 판(46de4) · 0x4403c 뒤라 그 둘까지 늘리고, 뒤에 그리는 HOMERUN 글자(46e5c) · 득점판(46e62)은 안 늘린다.
 *
 * ## 큰 OUT — 결과 판 0x46844 (그리기 46de4, 0x4403c 보다 앞)
 * ```
 * 51a56  메시지 0xbba(v) 처리: +0x108c = 10 · +0x10ac = v · +0x1088 = 플레이+0x130 (공 가진 야수)
 * 46850  +0x108c ≤ 0 이면 아무것도 안 함 ; +0x1088 == −1 이면 자리 = (W/2, H/2), 아니면 그 야수 그림 자리(0x43278 이 적은 +0x1984 · +0x1988)
 * 4688e  +0x108c −= 1
 * 46892  +0x1997 == 0 && v == 13:
 *          +0x1998 이면 game_judge 애니 2 를 (x, y − 60) 에 (0xba759 종류 2 · 진행 1) ; 끝 비트면 +0x1998 = 0 · +0x1997 = 1 · +0x108c = 0
 *                       +0x1999 면 state[0x8b] = 1 ; +0x1999 = 0
 *          아니면 아무것도 안 그린다
 *        그 밖: +0x1999 = +0x1998 = 0 · +0x1997 = 1 · 보통 판정 글자 0x393b4(x, y − 30, v, 1, 0) — `stepJudgePopup`
 * ```
 * +0x1997 은 투구(0x11 진입 0x3de10)가 1 로, 레이저 연출 0x4403c · 필살 포구 연출 0x441c4 · 0x44398 의 단계 0 이 0 으로 적고,
 * +0x1998 은 그 셋의 끝이 세운다(레이저만 +0x1999 도 — `defenseScene`). 애니 2 는 0x10 진입 0x39894 가 공마다 되감는다.
 * 애니 2 = 프레임 35 · 36 · 37 · 38 · 37 · 40 · 39 (지연 2 · 2 · 2 · 2 · 2 · 2 · 0) — 끝 비트는 13 번째 그림. 판 하나의 타이머는
 * 10 그림이라 한 번에는 끝까지 못 가고(38 → 37 에서 끊긴다), 같은 판에 코드 13 이 또 오면 이어서 그린다.
 */
export {
  NO_ZOOM_PUNCH,
  startZoomPunch,
  stepZoomPunch,
  zoomSourceRect,
  type ZoomPunchFrame,
  type ZoomPunchState,
} from '@/features/defense-play/model/laserPresentation/zoomPunch'
export {
  JUDGE_POPUP_START,
  postJudgeMessage,
  stepJudgePopup,
  type BigOutFrame,
  type JudgePopupState,
  type JudgeTextFrame,
} from '@/features/defense-play/model/laserPresentation/judgePopup'
