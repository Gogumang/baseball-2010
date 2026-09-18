// 이 파일은 tools/generate_game_data.py 가 원본 패키지에서 생성했다.
// 직접 고치지 말고 생성기를 고칠 것.

export interface PitchTypeInfo {
  readonly name: string
  /** 변화량 (존 단위). 원본 궤적 제어점에서 계산했다. */
  readonly horizontalBreak: number
  readonly verticalBreak: number
  /** 구속 계수. 원본 궤적의 레코드 수 비율이다. */
  readonly speed: number
  /**
   * 구속 1~4단계별 비행 프레임 수. pitch.zt1 레코드의 `단계` 값 그대로다.
   * 앞이 느리고 뒤로 갈수록 빠르다 (FASTBALL 18/16/14/12).
   */
  readonly flightSteps: readonly number[]
}

/** 원작 구질 21종. 이름은 binary.mod, 변화량·구속·비행 프레임은 data/pitch.zt1 에서 왔다. */
export const PITCH_TYPES: readonly PitchTypeInfo[] = [
  { name: 'FASTBALL', horizontalBreak: 0.000, verticalBreak: 0.000, speed: 1.000, flightSteps: [18, 16, 14, 12] },
  { name: 'TWO-SEAM', horizontalBreak: 0.232, verticalBreak: -0.124, speed: 0.500, flightSteps: [23, 21, 19, 17] },
  { name: 'H.FAST', horizontalBreak: 0.007, verticalBreak: -0.145, speed: 0.500, flightSteps: [22, 20, 18, 17] },
  { name: 'SINKER', horizontalBreak: 0.401, verticalBreak: -0.215, speed: 0.625, flightSteps: [23, 22, 21, 20] },
  { name: 'SHOOT', horizontalBreak: 0.255, verticalBreak: 0.011, speed: 0.500, flightSteps: [20, 19, 17, 15] },
  { name: 'SLIDER', horizontalBreak: -0.430, verticalBreak: 0.010, speed: 0.500, flightSteps: [20, 19, 18, 17] },
  { name: 'CURVE', horizontalBreak: -0.319, verticalBreak: -0.170, speed: 0.625, flightSteps: [23, 22, 21, 20] },
  { name: 'FORK', horizontalBreak: -0.014, verticalBreak: -0.534, speed: 0.500, flightSteps: [22, 21, 20, 18] },
  { name: 'CHANGEUP', horizontalBreak: 0.105, verticalBreak: -0.900, speed: 0.500, flightSteps: [24, 23, 22, 21] },
  { name: 'CUT FAST', horizontalBreak: -0.266, verticalBreak: 0.008, speed: 0.500, flightSteps: [20, 18, 16, 14] },
  { name: 'R.FAST', horizontalBreak: -0.015, verticalBreak: 0.403, speed: 0.500, flightSteps: [19, 17, 15, 13] },
  { name: 'H.SINKER', horizontalBreak: 0.401, verticalBreak: -0.215, speed: 0.500, flightSteps: [20, 19, 17, 15] },
  { name: 'H.SHOOT', horizontalBreak: 0.186, verticalBreak: 0.061, speed: 0.500, flightSteps: [19, 18, 16, 14] },
  { name: 'H.SLIDER', horizontalBreak: -0.392, verticalBreak: -0.010, speed: 0.375, flightSteps: [19, 18, 17, 15] },
  { name: 'S.CURVE', horizontalBreak: -0.314, verticalBreak: -0.442, speed: 0.500, flightSteps: [24, 25, 26, 28] },
  { name: 'S.CHANGEUP', horizontalBreak: -0.014, verticalBreak: -0.273, speed: 0.500, flightSteps: [20, 19, 18, 16] },
  { name: 'GYRO', horizontalBreak: 0.250, verticalBreak: -0.565, speed: 0.500, flightSteps: [24, 23, 22, 21] },
  { name: 'P.SINKER', horizontalBreak: -0.098, verticalBreak: 0.005, speed: 0.500, flightSteps: [18, 17, 16, 14] },
  { name: 'P.SLIDER', horizontalBreak: 0.513, verticalBreak: -0.289, speed: 0.375, flightSteps: [19, 17, 15, 13] },
  { name: 'KNUCKLE', horizontalBreak: -0.497, verticalBreak: 0.010, speed: 0.500, flightSteps: [18, 17, 15, 13] },
  { name: 'SPECIAL', horizontalBreak: -0.226, verticalBreak: -0.632, speed: 0.500, flightSteps: [26, 29, 32, 35] },
]
