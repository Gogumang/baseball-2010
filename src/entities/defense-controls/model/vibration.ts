/**
 * 스윙 타이밍 → 진동 길이 (binary.mod 0xac758 · 메시지 0xbc5 → 0x5228c → 0x3a44 vibrate).
 *
 * 타구가 맞은 모든 스윙에서 타이밍 점수 t(0~100)를 1/2/3 등급으로 자르고, 등급이 곧 진동 길이다.
 * **게임 규칙에는 전혀 영향이 없다 — 순수 햅틱 연출** (R15-ac758.md 1~4절 확정).
 *
 * 울리는 것은 게임 쪽 진동 함수 **0x3a44 `vibrate(ms)`** 다 — 저장 +0x3b(환경설정 "진동")가 켜졌을 때만
 * 0x6e538(snd, ms, 100) 으로 예약한다 (L 1-E). 웹은 `vibrate()` 가 같은 자리에서 `navigator.vibrate` 를
 * **지원될 때만** 부른다. 원본 호출지(L 1-E 표):
 * - 0x5228c ← 메시지 0xbc5 — 맞은 모든 타구, 등급 1/2/3 = 100/200/300ms (`vibrationMillisecondsOf`) → 타석 화면
 * - 0x51b0e — 사구 판정(v4) 직후 200ms (`HIT_BY_PITCH_VIBRATION_MILLISECONDS`) → 타석 화면
 * - 0x8cece·0x8cee6 — 이벤트 명령 5 화면효과 1·2 의 500ms (`EVENT_VIBRATION_MILLISECONDS`) → 이야기 재생기
 * - 0x29684 환경설정에서 진동을 켤 때 100ms · 0x3cc20 경기 중 메뉴 진동 토글 100ms — 웹 화면 쪽 미배선
 * - 0x4d0d6 (0x4ce9c, 상태 18 그리기) 100ms — 조건 칸(state[0xc] == 5 · +0x2c == 0)의 뜻 미해결이라 미배선
 */

/** d_level.dat D[0x10] = 0 — 타이밍 점수 하한 */
export const TIMING_SCORE_MINIMUM = 0
/** d_level.dat D[0x12] = 100 — 타이밍 점수 상한 */
export const TIMING_SCORE_MAXIMUM = 100

export type VibrationGrade = 1 | 2 | 3

/** 0x5228c 스위치 — 등급 1/2/3 = 100/200/300 ms */
export const VIBRATION_MILLISECONDS_BY_GRADE: Readonly<Record<VibrationGrade, number>> = {
  1: 100,
  2: 200,
  3: 300,
}

/**
 * 0xac758 본문 그대로:
 *   span = 100 − 0 = 100, v = t − 0
 *   v ≥ span/3(=33)  → 3
 *   v ≤ −span/3(=−33) → 1
 *   그 밖            → 2
 * 나눗셈은 __divsi3(0 쪽으로 자름)이라 100/3 = 33, −100/3 = −33 이다.
 *
 * t 는 0x34be0 이 하한 0 으로 자르므로 **실제로는 등급 1(100ms)이 나오지 않는다** — 코드상 갈래만 남아 있다.
 * 원본 갈래를 그대로 두기 위해 여기서도 음수 입력을 받아 1 을 돌려준다.
 */
export function vibrationGradeOf(timingScore: number): VibrationGrade {
  const span = TIMING_SCORE_MAXIMUM - TIMING_SCORE_MINIMUM
  const value = timingScore - TIMING_SCORE_MINIMUM
  const third = Math.trunc(span / 3)
  if (value >= third) return 3
  if (value <= -third) return 1
  return 2
}

export function vibrationMillisecondsOf(timingScore: number): number {
  return VIBRATION_MILLISECONDS_BY_GRADE[vibrationGradeOf(timingScore)]
}

/** 사구 판정(v4) 0x51b08~0x51b0e 의 `vibrate(200, 100)` */
export const HIT_BY_PITCH_VIBRATION_MILLISECONDS = 200

/** 이벤트 명령 5 화면효과 1·2 의 진동 (0x8cece · 0x8cee6) */
export const EVENT_VIBRATION_MILLISECONDS = 500

/** 진동을 울릴 수 있는 곳 — 기본은 브라우저 `navigator.vibrate`. 없으면(데스크톱 등) 아무 일도 안 한다 */
export type VibrateFunction = (milliseconds: number) => void

function browserVibrate(): VibrateFunction | null {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return null
  return (milliseconds) => {
    navigator.vibrate(milliseconds)
  }
}

/**
 * 게임 쪽 진동 0x3a44 — 환경설정 진동(저장 +0x3b)이 켜졌고 길이가 0 보다 클 때만 울린다
 * (0x6e538 의 `ms > 0` 거름). 시험은 `device` 로 받는 쪽을 바꿔 끼운다.
 */
export function vibrate(
  milliseconds: number,
  isVibrationOn: boolean,
  device: VibrateFunction | null = browserVibrate(),
): void {
  if (!isVibrationOn || milliseconds <= 0 || device === null) return
  device(milliseconds)
}
