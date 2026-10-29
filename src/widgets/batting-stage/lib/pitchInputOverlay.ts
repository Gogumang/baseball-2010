/**
 * **사람 투구 UI — 장면 위 그림** (구질 목록 0xf · 조준 0x10 · 게이지 0x11). 2026-10-09 직접 떴다.
 *
 * 원본은 이 셋을 장면 그리기 안에서 그린다 — 웹 화면 아래 패널(`PitchSlotPicker` · `AimCursor` · `PitchGradeGauge`)은 키 · 틱을
 * 맡고, 지금 그림 재료를 `PitchInputOverlay` 로 장면(`PitcherSideStage`)에 넘긴다. 그림은 모두 `ui/slt_pitch.pzx`([+0x1010]).
 *
 * ── 0xf 구질 목록 — 타석 공용 그리기 0x4c4bc 의 4c528~4c8de ──────────────────────────────────────────────
 * ```
 * 4c528  상태 == 0xf ∧ 0x33fe4(수비 조작 사람) → 아래. 아니면 존 0x35ae8 (곧 사람이 던지는 0xf 는 존 대신 목록)
 * 4c570  (x0, y0) = 투수 앵커 0xcfb18[+0x17e1] 투영 + 카메라 (= stageLayout.pitcherAnchor)
 * 4c5a6  빛 지도 [+0x1108](ui/slt_pitch.raw 30×30, 0x3ed16 이 싣고 +0x1c = 16):
 *        0x9cb89 = 반 해상도 판을 15 로 채움 · 0x9cba9(x0, y0 − 20) = 원 도장(값 31) ·
 *        0x9ce71 → 0x9cd14 = 화면 점마다 RGB565 각 성분 × 값 / 32 (판 한 칸이 화면 2×2)
 *        → 화면 전체가 15/32 로 어두워지고 투수 둘레 지름 60 원만 31/32 로 밝다
 * 4c5d4  [+0x1074](0xf 진입 0x3d954 가 0x16) ≤ 0x19 이면:
 *          칸 i = 1..4 의 바이트 [+0x1078 + i](진입이 구질 있는 칸만 0x26 + 4(i − 1), 없으면 0) > 0 → 프레임 [바이트] 를 (x0, y0) 에,
 *          [+0x1074] ≤ 0x18 이면 바이트 + 1 ; 그 뒤 프레임 [+0x1074] 를 (x0, y0) 에
 *        [+0x1074] ≤ 0x18 이면 + 1 하고 끝 — 곧 진입 뒤 그림 0 · 1 · 2 는 고리 22 · 23 · 24 와 칸 틀만, 그림 3 부터 고리 25 위에 칸
 * 4c684  칸 i = 1..5 (구질 [+0xfac + 4i]):
 *          구질 == 22(마구): 남은 마구 0xaea11 > 0 일 때만 애니 5 를 (x0, y0) 에, num.pzx 그림 [남은] 을 (x0 + 0x34, y0 + 0x16) 에
 *          구질 ≠ 0: 그림(이미지) 표 0xcfd37[구질] 을 (x0, y0) + 프레임 25 상자 [i − 1] 의 (x, y) 에,
 *                    이름 프레임 (구질 − 1) 을 상자 [i + 3] 의 y 에 — i 1 · 3 은 상자 x 에서 왼쪽 맞춤, 2 · 4 는 상자 오른쪽 끝에 오른쪽 맞춤
 * 4c7d4  반짝임 [+0x1078] == 0 ∧ (상태 틱 == 4 ∨ (틱 ≠ 0 ∧ 틱 mod 70 == 0)) → 켬 · 애니 2 를 첫 칸 · 반복 없이,
 *        켜져 있으면 애니 2 를 (x0, y0) 에 그리고 한 칸 진행, 끝 칸이면 끔 (칸 0 은 0xf 진입 · 0x3e8d6 이 0)
 * ```
 * 칸 0(OK) 은 그리지 않는다 — 고리 프레임 25 에 "OK" 가 그려져 있다.
 *
 * ── 0x10 조준 — 상태 그리기 0x4d780 ──────────────────────────────────────────────────────────────────
 * ```
 * 4d7a0  경로 [+0x1140] = 조준점 [+0x10b8] ; 공 틱 = 0 → 0x35854 = 조준점의 화면 점(투영 0xbe3d8 — `projectToScreen`)
 * 4d7da  애니 0(진입 0x3d954 가 첫 칸 · 반복으로 건다) 을 그 점에, 한 칸 진행
 * 4d824  구질 1..21: 이름 프레임 (구질 − 1) — x = 존.x + (존.w − 폭) >> 1, y6 = 존.y − 높이 (존 = 0xcfb7c[+0x17e1] + 카메라)
 *        0x6a9f1(x − 5, y6 − 5, 폭 + 10, 높이 + 2, 0x28000000) 반투명 검정 판 → 이름을 (x, y6 − 4) 에
 * 4d8fc  구질 == 22(마구): 0x15605d4(0, 0, W, H, 5) — 화면 덮개 단계 5
 * ```
 * 판 · 덮개는 바로 그리고 애니 · 이름은 그리기 목록(0xbe8a5 · 0xbe8d5)에 넣어 0xbe6a1 이 투수 · 타자와 함께 그린다 —
 * 곧 판 · 덮개는 선수 **아래**, 애니 · 이름은 선수 **위**(목록 깊이 [0xcfa8c + 0x14] 는 앞쪽).
 *
 * ── 0x11 게이지 — 상태 그리기 0x4d2ac ──────────────────────────────────────────────────────────────────
 * ```
 * 4d2dc  (x, y) = 조준점의 화면 점 (투수 앵커 + [+0x218] 투영 → 0xb94b5 + 카메라 — `projectToScreen` 과 같은 점)
 * 4d360  모드 ≠ 7 이고 (사람 공격 아님 ∧ 설정 +0x2d(게이지) == 0) 이면 프레임 0x23(35) 을 그 점에 (CPU 투구 난이도 +0x2c 가 기본 2 일 때)
 * 4d3f6  0x3f500(게이지 켬 ∧ 구질 ≠ 22) ∧ 0x33fe4 → 게이지 (`pitchGaugeSprite` 의 규칙):
 *        t == 0: 커서 ≤ 8 이면 0 → 0x3a, 아니면 0x3b 위 min(0x3b + 커서, 0x43) ; 커서 > 8 → 0x3a
 *        t > 0: min(0x3b + 커서, 0x43)(효과 1 · 인자 8) · 애니 1 이 안 끝났으면 min(0x3b + 누른 칸, 0x43) · 애니 1 · t == 5 면 game_effect 애니 0,
 *               애니 1 이 끝났으면 [+0x17c4] ≤ 3 동안 결과 원을 효과 1 · 인자 15 − 3·틱 으로(흐려짐)
 * ```
 * 게이지의 t > 0 덧그림(효과 1 · 인자 8 멈춘 커서 · 애니 1 · t == 5 game_effect 애니 0 · 흐려지는 결과 원)은 `gaugeDrawsOf`.
 * 애니 · 이름 · 게이지의 깊이는 [0xcfa8c + 0x14] = 29705 로 타자(0xd3a70[5] = 29705)와 같아 넣은 차례로 타자 · 투수(24500) 다음이다(r184).
 * 공(0x3b2f4 3b6de)의 깊이 [sp+0x88] 은 경로 점의 월드 z 라(r271 직접 떴다) `renderBattingStage` 의 그리기 목록이 공과의 앞뒤를 가른다 —
 * 공이 타자 깊이에 못 미치면 이 그림들 밑, 닿으면(z = 29705) 넣은 차례가 뒤라 위다.
 */

export type { PitchGaugeOverlay, PitchInputOverlay } from '@/widgets/batting-stage/lib/pitchInputOverlay/overlayTypes'
export { MAGIC_TYPE_NUMBER } from '@/widgets/batting-stage/lib/pitchInputOverlay/overlayAssets'
export {
  pitchMenuFrameOf,
  pitchMenuLabelX,
  pitchMenuShineStepOf,
  spotlightLevelAt,
} from '@/widgets/batting-stage/lib/pitchInputOverlay/pitchMenuLayout'
export { drawPitchInputSprites, drawPitchInputUnderlay } from '@/widgets/batting-stage/lib/pitchInputOverlay/aimAndGauge'
export { GAUGE_TARGET_FRAME, gaugeDrawsOf, showsGaugeTargetFrameOf } from '@/widgets/batting-stage/lib/pitchInputOverlay/gaugeDraws'
export { drawPitchMenu } from '@/widgets/batting-stage/lib/pitchInputOverlay/drawPitchMenu'
