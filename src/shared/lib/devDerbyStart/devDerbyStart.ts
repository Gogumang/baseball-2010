/**
 * **홈런더비 단계 바로가기 칸** (웹 개발 도구 — 원본에 없다). 장면 바로가기(`app/dev/scenes` 의 `derby-stage<N>`)가 더비 화면에
 * 들어서기 전에 적어 두면 `useHomeRunDerby` 가 첫 판(0xb6814 초기화 값)에 덮어 **그 단계의 시작 상태**에서 판을 연다 —
 * 단계 2 이상 마투수 소개 · 투구 판을 실제로 쳐서 닿지 않고 보려고(A-07, r294).
 *
 * 게임 길은 이 칸을 쓰지 않는다 — 적는 곳은 장면 표(개발 · e2e 에서만 동적으로 읽힌다)뿐이고, 읽는 곳은 스위치를 그 자리에
 * `import.meta.env.DEV || import.meta.env.MODE === 'e2e'` 로 써서 배포 빌드에서 접힌다(`app/dev/sceneShortcut` 머리말과 같은 까닭).
 * 더비 화면이 첫 그림에서 한 번 읽고 지운다 — 다시하기 · 재도전은 원본대로 0 단계부터다.
 */
export interface DevDerbyStart {
  /** 단계 +0x38 */
  readonly stage: number
  /** 누적 비거리 +0x34 */
  readonly totalDistance: number
  /** 남은 기회 +0x33 */
  readonly remainingPitches: number
}

let pending: DevDerbyStart | null = null

export function setDevDerbyStart(next: DevDerbyStart | null): void {
  pending = next
}

export function devDerbyStartNow(): DevDerbyStart | null {
  return pending
}
