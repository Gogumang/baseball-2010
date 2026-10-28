/**
 * 원작 게임 루프의 한 번 갱신 시간.
 *
 * binary.mod 0x9f524 가 속도 옵션으로 fps 를 정한다 — 표 0xd7624 = 4·10·16·22·28 fps
 * (250·100·62·45·35 ms). 환경설정 [속도] 가 이 다섯 단계를 고른다 (StrMAINMENU[33], [64]).
 * 옵션 기본값은 가운데(칸 2, 16fps, 62ms) 다 — 새 저장 초기화 0x9f2a4 확인, **확정**
 * (K-bursts-special.md K-5 5-1).
 * 원본 데이터의 시간은 전부 이 갱신 횟수로 적혀 있다(구질 비행 프레임, PZX 지연).
 *
 * 설정 화면 하나가 바꾸고 애니메이션 루프 여럿이 매 프레임 읽는 값이라 모듈 상태로 둔다.
 * 반드시 millisecondsPerFrame() 으로 그때그때 읽는다 — 모듈 로딩 시점에 곱해 두면 설정이 반영되지 않는다.
 */
export const MILLISECONDS_PER_FRAME_BY_SPEED: readonly number[] = [250, 100, 62, 45, 35]

export const DEFAULT_SPEED_LEVEL = 2

let currentSpeedLevel = DEFAULT_SPEED_LEVEL

/**
 * 틀 길이가 바뀐 **그 순간**에 부르는 손잡이 — 틱 시계(`frameClock` 의 앱 틱)가 바뀐 때 든 틱의 머리를 새 기준점으로 잡게 한다.
 * 원본은 앱 루프 하나가 틀 길이(0x9f524)만 바꿔 그 뒤로 새 길이로 돈다 — 시계가 다음에 읽힐 때 늦게 알아채면, 공용 창 아래에서
 * 서 있던 경기 장면처럼 늦게 읽히는 쪽만 다른 자리에 기준점을 잡는다.
 */
const speedChangeListeners = new Set<() => void>()

/** 틀 길이가 바뀐 때 알림을 받는다 — 돌려준 함수로 끊는다 */
export function onGameSpeedChange(listener: () => void): () => void {
  speedChangeListeners.add(listener)
  return () => {
    speedChangeListeners.delete(listener)
  }
}

export function setGameSpeedLevel(level: number): void {
  if (!Number.isInteger(level) || MILLISECONDS_PER_FRAME_BY_SPEED[level] === undefined) {
    throw new Error(`속도 단계는 0~${MILLISECONDS_PER_FRAME_BY_SPEED.length - 1} 정수여야 합니다 (입력값: ${level})`)
  }
  if (level === currentSpeedLevel) return
  currentSpeedLevel = level
  for (const listener of speedChangeListeners) listener()
}

export function gameSpeedLevel(): number {
  return currentSpeedLevel
}

export function millisecondsPerFrame(): number {
  return MILLISECONDS_PER_FRAME_BY_SPEED[currentSpeedLevel]
}
