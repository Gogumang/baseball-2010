/**
 * **큰 타구 0x13 의 화면 연출** — 0x13 그리기 0x4cb1c 의 꼬리(4cb76~4ce0e, 2026-10-24 직접 떴다). 공용 그림(투수 · 주자 · 타자 · 공 ·
 * 그리기 목록 0xbe6a1 · 투구 기계 0x42f2c · HUD 0x4c4bc) **뒤**, 감상 플래그 +0x199a 가 선 타구에서만:
 * ```
 * 4cb8c  점 = 타격점 (+0x10dc, +0x10e0) 투영 0xb94b5 + 카메라 (+0xff4, +0xff8)          ; [sp+0x2c] · [sp+0x30]
 * 4cbb4  공 틱 [+0x1098] ≠ 0 이면 4cdac(뒤 갈래)로
 * ── 멈춤 갈래(공 틱 0) ──
 * 4cbc0  px = trunc(W × 0xcfb54[+0x17e1].x / 480) · py = trunc(H × 0xcfb54[+0x17e1].y / 390)   ; 우타 (242, 326) · 좌타 (237, 326)
 * 4cc18  [+0xfe6] == 0 이면: 0xbb43c(+0xff4, +0xff8, 100 + 2 × (6 − [+0x10a8]), px, py) 화면 확대 → 0xc3469(0, 0, W, H, 2) 흐리기
 * 4cc6c  [+0x10a8] 이 홀수면 번쩍임 — 창 객체 0x75b19 · 표 0xd0244(0x180 바이트 = 세모 16 개)를 베껴 채우기 · 테두리 0x78FFFFFF 로
 *        세모마다 0x75ba5(점 3) · 0x75e31, 끝에 0x75b79
 * 4ccba  옛값 = [+0x10a8], [+0x10a8] −= 1 — 옛값 < 0 이면 막음 +0x10a0 · +0x19a4 를 풀고 애니 3 되감기(0x93cfd) · 016 쏘기(위 점)
 * 4cd18  [+0xfe6] == 0 이면 검은 테두리 4 줄(0x6a9f1, 색 0): (0, 0, W, 4) · (0, 0, 4, H) · (0, H − 4, W, 4) · (W − 4, 0, 4, H)
 * ── 뒤 갈래(공 틱 ≥ 1) ──
 * 4cdd6  0xc3469(0, 0, W, H, 1) 흐리기 → 4cdfa game_effect 애니 3([[+0x102c]+0x10]+8 의 넷째 칸)을 위 점에 0x93c45 → 4ce0c 0x93d91(한 칸)
 * ```
 * [+0x10a8] 은 맞을 때 6(5183c)이고 공 틱이 0 인 그림마다 1 준다 — 공 틱은 멈춤(`hitPause.HIT_STOP_TICKS`) 동안 0 이라 0x13 틱 k(0~7)의
 * 값이 6 − k 다. 틱 7 그림이 막음을 풀고 그 틀 끝(0x3f378)부터 공 틱이 오르니 틱 8 부터가 뒤 갈래다(되감은 애니 3 의 칸 0 이 틱 8).
 *
 * **[+0xfe6]** 은 0x47b2c(경기, 1)이 0xbdea1(화면 효과기 [0x140007c], px, py) 의 되돌림으로 적는다 — 0xbdea0 은 남은 메모리
 * (0x1400508)가 W × H × 2 이상일 때만 화면을 (px, py) 쪽 방사 흐림으로 떠 이미지(0x1400678)로 두고 1 을 돌려준다. 그러면 0x47c68 이
 * +0x19a4 동안 그 이미지(0xbdbcd)를 배경 자리에 덮고, 4cc18 · 4cd18 이 확대 · 흐리기 · 테두리를 건너뛴다. 기기 메모리에 달린 갈래라
 * 바이너리로 정할 수 없다. ⚠️ 미확인: 웹은 [+0xfe6] == 0(메모리 모자람) 갈래 — 확대 · 흐리기 · 테두리 — 로 둔다(남김 — 기기 남은 메모리
 * 0x1400508 은 단말 몫이라 바이너리 밖). 1 갈래(방사 흐림
 * 배경 · 카메라 다시 잡기 0xb9481 · 0x40ff0 배경 다시 그리기, 효과기 +0x29 는 장면 초기화 0x3e340 만 −1 로 되돌려 장면에서 처음 큰 타구만
 * 뜬다)는 옮기지 않았다.
 * 카메라 (+0xff4, +0xff8) 은 0x13 동안 틀 머리 0x3f060(3f1f2~3f2d8)이 공을 따라 옮긴 타석 카메라 [+0x1ec] 다(`hitCamera`, r292). 웹 그림은
 * 고정 오프셋(`projectToScreen` 의 (−120, −70) = 가운데 카메라) 위에 그 차이만큼 캔버스를 옮겨 그린다(`StageScene.camera`). 멈춤 갈래는
 * 막음 [+0x10a0] 동안이라 틀 머리가 카메라를 안 건드려 늘 가운데다 — 뒤 갈래의 애니 3 자리만 카메라를 탄다.
 *
 * - 막음 · 갈래 · 끝 틱 · 스윙 멈춤(`bigHitClock`) · 확대 · 흐리기 · 번쩍임 · 테두리(`bigHitEffects`) · 집중선 표 0xd0244(`flashTriangles`)
 */

export { bigHitReleaseTickOf, bigHitScreenOf, bigHitEndTickOf, bigHitSwingSkipsOf } from '@/widgets/batting-stage/lib/bigHitScreen/bigHitClock'
export type { BigHitScreen } from '@/widgets/batting-stage/lib/bigHitScreen/bigHitClock'
export {
  bigHitZoomPercentOf,
  bigHitFlashesAt,
  bigHitZoomCenterOf,
  BIG_HIT_HOLD_BLUR,
  BIG_HIT_FOLLOW_BLUR,
  BIG_HIT_FLASH_COLOR,
  bigHitBorderRectsOf,
  BIG_HIT_FOLLOW_ANIMATION,
} from '@/widgets/batting-stage/lib/bigHitScreen/bigHitEffects'
export { BIG_HIT_FLASH_TRIANGLES } from '@/widgets/batting-stage/lib/bigHitScreen/flashTriangles'
