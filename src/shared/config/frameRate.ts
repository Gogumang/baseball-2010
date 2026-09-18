/**
 * 원작 게임 루프의 한 번 갱신 시간.
 *
 * binary.mod 0x9f524 가 속도 옵션으로 fps 를 정한다 — 표 0xd7624 = 4·10·16·22·28 fps
 * (250·100·62·45·35 ms). 환경설정 [속도] 가 이 다섯 단계를 고른다 (StrMAINMENU[33], [64]).
 * 옵션 기본값은 아직 못 찾아서 가운데(16fps, 62ms)를 쓴다 — **추정**.
 * 원본 데이터의 시간은 전부 이 갱신 횟수로 적혀 있다(구질 비행 프레임, PZX 지연).
 *
 * 설정 화면 하나가 바꾸고 애니메이션 루프 여럿이 매 프레임 읽는 값이라 모듈 상태로 둔다.
 * 반드시 millisecondsPerFrame() 으로 그때그때 읽는다 — 모듈 로딩 시점에 곱해 두면 설정이 반영되지 않는다.
 */
export const MILLISECONDS_PER_FRAME_BY_SPEED: readonly number[] = [250, 100, 62, 45, 35]

export const DEFAULT_SPEED_LEVEL = 2

let currentSpeedLevel = DEFAULT_SPEED_LEVEL

export function setGameSpeedLevel(level: number): void {
  if (!Number.isInteger(level) || MILLISECONDS_PER_FRAME_BY_SPEED[level] === undefined) {
    throw new Error(
      `속도 단계는 0~${MILLISECONDS_PER_FRAME_BY_SPEED.length - 1} 정수여야 합니다 (입력값: ${level})`,
    )
  }
  currentSpeedLevel = level
}

export function gameSpeedLevel(): number {
  return currentSpeedLevel
}

export function millisecondsPerFrame(): number {
  return MILLISECONDS_PER_FRAME_BY_SPEED[currentSpeedLevel]
}
