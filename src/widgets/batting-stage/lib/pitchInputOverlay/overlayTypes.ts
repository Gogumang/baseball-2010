/** 사람 투구 UI 의 그림 재료 — 구질 목록 0xf · 조준 0x10 · 게이지 0x11 (`PitchInputOverlay`) */
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'

/** 0xf — 구질 목록 */
export interface PitchMenuOverlay {
  readonly kind: '구질'
  /** 칸 0..5 의 구질 번호 (경기 +0xfac + 4·칸, 0 = 빈 칸) */
  readonly typeNumbers: readonly number[]
  /** 남은 마구 (0xaea11) */
  readonly magicRemaining: number
  /** 0xf 에 든 뒤 그림 수 (상태 틱) */
  readonly tick: number
  /**
   * 빈 칸(구질 0) 키를 누른 차례 표지 — 0x50de8 이 투수 그림 객체(+0xf98)에 0x9dff8(…, 2)를 건다(대기 동작 한 바퀴).
   * 누를 때마다 새 값(0 은 안 누름)이라 장면이 바뀐 것을 보고 그 틱부터 대기 동작을 다시 센다. 안 주면 안 누름
   */
  readonly pitcherIdlePress?: number
}

/** 0x10 — 조준 */
export interface PitchAimOverlay {
  readonly kind: '조준'
  readonly aim: WorldPoint
  /** 투영 원점 칸 (진행기 `stageSide`) */
  readonly aimSide: number
  readonly typeNumber: number
  /** 0x10 에 든 뒤 그림 수 — 애니 0 은 0xf 진입 0x3d954 가 되감고 0x10 그림마다 한 칸 나간다 */
  readonly tick: number
}

/** 0x11 — 게이지 */
export interface PitchGaugeOverlay {
  readonly kind: '게이지'
  readonly aim: WorldPoint
  readonly aimSide: number
  /** 0x3f500 — 게이지 켬 ∧ 마구 아님 */
  readonly showsGauge: boolean
  /** 환경설정 게이지(+0x2d) — 꺼져 있으면 목표점에 프레임 35 */
  readonly gaugeSettingOn: boolean
  /**
   * 목표 표시 프레임 0x23 을 넣는가 — 부르는 쪽이 `showsGaugeTargetFrameOf`(0x4d360) 로 낸 값. 안 주면 예전처럼 게이지 설정이 꺼졌을 때
   */
  readonly showsTargetFrame?: boolean
  /** 커서 +0x17bc */
  readonly cursor: number
  /** 누른 칸 +0x17c8 (0 = 아직) */
  readonly pressed: number
  /** 칸을 정한 뒤 그림 수 */
  readonly decidedTicks: number
  /**
   * 고른 구질이 마구(22)인가 — [경기+0xfc8] 은 0xf 가 적고 0x10 OK(0x50e9c 50ea6~50eaa)가 그 값으로 남은 마구를 줄인 뒤 0x11 을
   * 예약한다. 그래서 0x11 그리기의 공 그림 0x3b2f4(3b4dc~3b4e4)는 놓기(틱 10) 전 와인드업 그림부터 마구 파티클을 쏜다(Q-09). 안 주면 거짓
   */
  readonly isMagicPitch?: boolean
  /**
   * 0x11 상태 틱 [+0x2c] — 게이지가 장면 틱 머리마다 올리는 칸(아직 안 셌으면 −1, 틱 10 에 놓는다). 장면이 놓기 전 그림(틱 0~9)을
   * 셀 때 읽는다(`PitcherSideStage`). 그림 재료가 아니라 칸이라 다시 그리지 않아도 지금 값이다
   */
  readonly stateTickRef?: { readonly current: number }
}

export type PitchInputOverlay = PitchMenuOverlay | PitchAimOverlay | PitchGaugeOverlay
