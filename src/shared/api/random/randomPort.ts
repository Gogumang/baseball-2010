/**
 * 난수를 도메인 밖에서 주입받기 위한 포트.
 * Math.random을 직접 부르면 "파워 80이 완벽 타이밍에 치면 홈런이 나오는가"를
 * 결정론적으로 검증할 수 없어서 반드시 이 포트를 통한다.
 */
export interface RandomPort {
  /** [0, 1) */
  next(): number
  nextInRange(minimum: number, maximum: number): number
  pick<T>(candidates: readonly T[]): T
}
