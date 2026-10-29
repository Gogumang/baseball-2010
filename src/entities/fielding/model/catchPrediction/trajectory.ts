import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'

/** 타구 궤적. 원본 공 객체 +0x74(점 목록) · +0x6c(점 개수) · +0xaa0(낙구 틱) 에 대응한다 */
export interface BattedBallTrajectory {
  /** 미리 계산된 점 개수 (공 +0x6c, 최대 130) */
  readonly length: number
  /** t 번째 점 (0xa2b78 = 0 ~ length−1 로 자른다). y 가 높이다 */
  pointAt(tick: number): WorldPoint
  /** 낙구 틱 = 처음으로 높이 ≤ 0 이 된 점 번호 (공 +0xaa0). 없으면 −1 */
  readonly landingTick: number
  /** 담장선을 넘은 첫 틱 (공 +0xaa4). 없으면 −1 */
  readonly fenceTick: number
  /** 폴(파울 기둥) 맞은 첫 틱 (공 +0xab0). 없으면 −1 */
  readonly poleTick: number
  /** 타구 시작점이 표준 배팅 지점 (20000, 1000, 30000) 인가 — 다이빙 후보 판정의 전제 (P2 2a) */
  readonly startedAtPlate: boolean
  /**
   * 담장 면(높이 ≤ 1999)에 맞고 꺾인 첫 틱 (공 +0xaa8). 없으면 −1.
   * 손으로 만든 시험 궤적은 안 줘도 된다 — 원본 물리(`battedBallFlight`)가 만든 궤적만 싣는다.
   */
  readonly wallTick?: number
  /** 담장을 넘은 페어 타구의 낙구 거리 눈금 0~160 (공 +0xac0, 0xa2a88) */
  readonly carryScale?: number
  /**
   * t 번째 점의 원본 칸 — 속도(+0xc) · 수직 속도(+0xe) · 각(+0x10) · 바운드 표시(+0x12) (0xa29bc).
   * 손으로 만든 궤적에는 없다.
   */
  pointDetailAt?(tick: number): {
    readonly speed: number
    readonly verticalSpeed: number
    readonly angle: number
    readonly bounceMark: number
  }
  /** 공+0x68 = t 일 때 공 vt18(0xa27f0) 멈춤 — 손으로 만든 궤적에는 없다 */
  isStoppedAt?(tick: number): boolean
  /**
   * **플레이 +0x127** — 타구 시작 0x51408 이 뽑은 패턴의 플래그 비트 1(`0xb07c8` = `0xb0744(…) & 2`)이면 세운다(0x514e6).
   * 공이 아니라 플레이 칸이지만 패턴에서만 오므로 궤적에 실어 넘긴다. 예보 0xb12d0(b1416)과 추적야수 AI 1(0xb4afe)이
   * 낙구 틱까지 낙구 지점으로 달리게 한다. 쥐기 0xb2710 이 지운다(수비 진행기 `landingChase`). 없으면 0.
   */
  readonly landingChase?: boolean
}
