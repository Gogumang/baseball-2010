/** 키 0x2896c 가 하는 일 — 'none' 은 아무것도 안 한다 */
export type FirstBatStadiumKeyAction = 'flip' | 'previous' | 'next' | 'ok' | 'back' | 'none'

/** 단계 0 — 날 키 (289ca~289f6). CLR 은 두 단계 모두 상태 19 · 단계 0 으로 */
const FIRST_BAT_PHASE_KEYS: ReadonlyMap<string, FirstBatStadiumKeyAction> = new Map([
  ['Escape', 'back'],
  ['ArrowLeft', 'flip'],
  ['ArrowRight', 'flip'],
  ['4', 'flip'],
  ['6', 'flip'],
  ['Enter', 'ok'],
  ['ArrowDown', 'ok'],
  ['5', 'ok'],
  ['8', 'ok'],
])

/** 단계 1 — 구장 격자가 바꾼 키 (28a36~28a64) */
const STADIUM_PHASE_KEYS: ReadonlyMap<string, FirstBatStadiumKeyAction> = new Map([
  ['Escape', 'back'],
  ['ArrowLeft', 'previous'],
  ['4', 'previous'],
  ['ArrowRight', 'next'],
  ['6', 'next'],
  ['Enter', 'ok'],
  ['5', 'ok'],
  ['ArrowUp', 'back'],
  ['2', 'back'],
])

/**
 * 키 0x2896c 의 두 갈래 (Q-14, 직접 떴다 — R4 3a 표와 같다):
 * ```
 * 단계 0 날 키 [장면+0x40] (289ca~289f6)
 *   ← −3 · → −4 · '4' · '6'      → 289f8  선공 커서 skin+0x74 뒤집기
 *   ↓ −2 · OK −5 · '5' · '8'      → 28a12  rec+8 = (skin+0x74 ≠ 0) · 단계 1 로
 *   CLR −16                       → 28a2e  상태 19 로
 *   ↑ −1 · 그 밖                  → 아무것도 안 한다
 * 단계 1 구장 격자 [this+0x74] vt+0x18(진입 0x23f18 `vt+0x1c(10, 1, 숫자키 꼴 1, 0x10)`)이 바꾼 키 (28a36~28a64)
 *   ← → '4' '6'                   격자가 커서를 옮긴다(0x6c0bc vt+8 — 꼴 0x10 은 끝에서 감는다). 키 함수는 그 값을 안 본다
 *   OK −5 · '5'                   → 28a66  rec+0xc = 커서 → 상태 21
 *   ↑ −1 · '2' · CLR −16          → 28a84 · 28a96  rec+0xc = 커서 · 단계 0 으로
 *   ↓ −2 · '8' · 그 밖            → 아무것도 안 한다 (28a60 의 '2'(0x32) 비교는 격자가 −1 로 바꾼 뒤라 닿지 않는다)
 * ```
 */
export function firstBatStadiumKeyActionOf(isStadiumPhase: boolean, key: string): FirstBatStadiumKeyAction {
  const keys = isStadiumPhase ? STADIUM_PHASE_KEYS : FIRST_BAT_PHASE_KEYS
  return keys.get(key) ?? 'none'
}
