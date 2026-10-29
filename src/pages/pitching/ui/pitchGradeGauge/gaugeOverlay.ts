import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import { showsGaugeTargetFrameOf } from '@/widgets/batting-stage/lib/pitchInputOverlay'
import type { PitchGaugeOverlay } from '@/widgets/batting-stage/lib/pitchInputOverlay/overlayTypes'
import type { PitchInputOverlayRef } from '@/pages/pitching/model/pitchInputOverlayRef'

/**
 * 장면 위 게이지(0x4d2ac — 목표점의 slt_pitch 원)의 재료를 실을 칸 — 확정한 조준점 · 투영 칸 · 환경설정 게이지(+0x2d).
 * 누름 칸도 그 목표점 둘레에 선다. 안 넘기면(장면 없음) 누름 칸이 판 전체다
 */
export interface GaugeOverlaySource {
  readonly ref: PitchInputOverlayRef
  readonly aim: WorldPoint
  readonly aimSide: number
  readonly gaugeSettingOn: boolean
  /**
   * 경기 모드 [+0x1104] — 목표 표시 프레임 0x23 판정 0x4d360(`showsGaugeTargetFrameOf`)이 본다. 이 부품은 사람이 던질 때만 서므로
   * 공격 측은 늘 CPU 다(이글아이 줄 4d380 은 사람 공격 갈래라 안 탄다). 안 주면 예전처럼 게이지 설정만 본다
   */
  readonly gameMode?: number
  /**
   * 고른 구질이 마구(22)인가 — 장면이 0x11 놓기 전 그림(틱 0~9)에 마구 공 파티클을 쏜다(0x3b2f4 3b4dc · Q-09). 안 주면 거짓
   */
  readonly isMagicPitch?: boolean
}

/**
 * 난이도(설정 +0x2c)는 원본도 늘 기본 2 다 — 바꾸는 화면이 없다(P7 K2). 게다가 이 화면은 미션(모드 5)이라 4d366 의 난이도 0 갈래는
 * 모드 5 · 6 에서 안 탄다
 */
const CPU_PITCH_DIFFICULTY = 2

/** 목표 표시 프레임 0x23 칸 — 모드를 안 주면 칸을 안 넣는다(장면이 게이지 설정만 본다) */
function targetFrameFieldOf(source: GaugeOverlaySource): Pick<PitchGaugeOverlay, 'showsTargetFrame'> {
  if (source.gameMode === undefined) return {}
  return {
    showsTargetFrame: showsGaugeTargetFrameOf({
      mode: source.gameMode,
      difficulty: CPU_PITCH_DIFFICULTY,
      isAttackSideHuman: false,
      eagleEyeGames: 0,
      gaugeSettingOn: source.gaugeSettingOn,
    }),
  }
}

/** 0x11 그림 재료 — 커서 `+0x17bc` · 누른 칸 `+0x17c8` · 정한 뒤 그림 수. 상태 틱 칸(`stateTickRef`)은 부르는 쪽이 끝에 붙인다 */
export function gaugeOverlayOf(
  source: GaugeOverlaySource,
  showsGauge: boolean,
  cells: { readonly cursor: number; readonly pressed: number; readonly decidedTicks: number },
): Omit<PitchGaugeOverlay, 'stateTickRef'> {
  return {
    kind: '게이지',
    aim: source.aim,
    aimSide: source.aimSide,
    showsGauge,
    gaugeSettingOn: source.gaugeSettingOn,
    ...targetFrameFieldOf(source),
    ...cells,
    ...(source.isMagicPitch === true ? { isMagicPitch: true } : {}),
  }
}
