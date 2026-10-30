import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'

export interface PitcherRepertoire {
  /** 투수 레코드 +0x1c 비트마스크 */
  readonly pitchMask: number
  /** 투수 폼 0xb6e24 (육성 0~5) */
  readonly form: number
  /** 투수 레코드 +0x18 마구 번호 (0 이면 마구 없음) */
  readonly magicNumber: number
  /** 마선수(마투수)인가 — 폼 6~10 쪽 레코드를 쓴다 */
  readonly isAce?: boolean
}

/** 구질 칸 한 자리 — 번호 0 이면 빈 칸이라 고를 수 없다 */
export interface PitchSlot {
  readonly slot: number
  /** 원본 구질 번호 1~21, 마구는 22. 0 이면 빈 칸 */
  readonly typeNumber: number
  readonly name: string
  readonly isMagic: boolean
}

/** 투수 능력치 (레코드 +0xc 부터 s16 네 칸, 0~999) */
export interface PitcherStats {
  readonly control: number
  readonly velocity: number
  readonly breaking: number
  readonly stamina: number
}

export interface HumanPitchInput {
  readonly typeNumber: number
  /**
   * 조준점 `+0x10b8/bc/c0` (x · y · z) — 투구 0x4dc78 이 세 칸을 그대로 목표로 복사한다(4dc9a).
   * 0x10 에서 사람이 움직인 값이다(`pitchAim`). 안 넘기면 0x10 진입 0x39894 의 존 중심 그대로(안 움직인 조준점).
   */
  readonly aim?: WorldPoint
  /** 등급 t (0~5) */
  readonly grade: number
  /**
   * 게이지에서 누른 칸 0~9 (안 눌렀거나 게이지를 안 쓰면 0). 게이지로 등급을 정한 공이면 이 칸이
   * 제구 흩어짐 반지름의 그림 칸(scene+0x17bc)이 된다 — `aimCellOf` 참조.
   */
  readonly gaugeCell: number
  readonly stats: PitcherStats
  readonly repertoire: PitcherRepertoire
  /** 화면 배치 side (투영 원점 0xcfb18 의 칸) */
  readonly side: number
}

/** `mistakeHumanPitchOf` 가 곡선을 다시 놓을 때 보는 칸 — `buildHumanPitch` 에 넘긴 값 그대로 */
export type MistakeHumanPitchInput = Pick<HumanPitchInput, 'typeNumber' | 'grade' | 'stats' | 'repertoire' | 'side'>
