import type { Coordinate } from '@/shared/lib/geometry/coordinate'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'

/**
 * 구질 이름. 원작 21종의 이름을 그대로 쓴다 (FASTBALL·SLIDER·CURVE…).
 * 이름·변화량·비행 프레임은 전부 shared/config/original/pitchTypes.ts 에 있다.
 */
export type PitchType = string

export interface Pitch {
  readonly type: PitchType
  /** 홈플레이트 통과 지점 (존 좌표). 타자가 맞혀야 하는 실제 코스다. */
  readonly plate: Coordinate
  /**
   * 변화량. 궤적 초반에는 plate에서 이 값을 뺀 지점을 향하다가
   * 도착 직전에 plate로 휜다. 직구는 (0, 0)이다.
   */
  readonly breakOffset: Coordinate
  /** 릴리스 → 홈플레이트 도달 시간. = frameCount × 한 틱 */
  readonly flightDurationMilliseconds: number
  /** 공이 나는 틱 수 N — 한 틱에 곡선 점 하나씩 (원본 투구 레코드 frames) */
  readonly frameCount: number
  /** 제구 등급 (0xb74bc). 판정 배율을 정한다. 사용자 투구처럼 등급이 없으면 −1 */
  readonly controlTier: number
  /**
   * 원본 3D 궤적 N 점 (월드 좌표, 0x4dc78). 마지막 점이 도착점이다.
   * 사용자 투구(투수편)는 아직 원본 입력을 옮기지 않아 null — 화면은 2D 추정 곡선으로 그린다.
   */
  readonly worldPath: readonly WorldPoint[] | null
  /** 화면 배치 side — 투영 원점(0xcfb18)과 기준점(0xcfb54)을 고른다 */
  readonly stageSide: number
}

/** 투수 레코드에서 온 폼·구질 (pitcherRepertoires) */
export interface PitcherRepertoireInfo {
  readonly form: number
  readonly pitchMask: number
  readonly magicId: number
}

export interface PitcherAbility {
  /** 제구 0~100. 낮을수록 의도한 코스에서 벗어난다. */
  readonly control: number
  /** 구속 0~100. 높을수록 비행 시간이 짧아진다. */
  readonly velocity: number
  /** 변화 0~100. 없으면 구속으로 대신한다 (추정) */
  readonly breaking?: number
  /** 없으면 기본 투수 레퍼토리 */
  readonly repertoire?: PitcherRepertoireInfo
}

export const DEFAULT_PITCHER_ABILITY: PitcherAbility = {
  control: 60,
  velocity: 60,
}
