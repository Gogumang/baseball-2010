/**
 * 견제 — binary.mod 0x53548(입력) · 0x50f28(메시지 0x10) · 0xb28be(플레이 시작) · 0xb47da(AI 상태 0xe).
 *
 * 견제는 따로 "아웃 확률" 식이 없다. 그냥 **수비 화면의 송구 시뮬레이션**(플레이 종류 4)을 한 판 돌려
 * 주자 귀루와 공 중 어느 쪽이 빠른지로 판정한다 (I-controls.md 4a — 0x10 가지에 난수가 없는 것까지 확인).
 *
 * **주자 리드 폭이라는 값은 원본에 아예 없다** (S8-fielding-ai-3.md 6절, 확정).
 * 주자는 루 좌표(0xd78f0)에 비트까지 정확히 서 있고, 루에 오프셋을 더하는 코드가 주자·야수 어느 쪽에도 없다.
 * 견제 시작 0xb28be 도 야수 넷만 루로 보내고 주자에게는 아무 호출도 하지 않는다.
 */

/** 견제 대상은 1·2·3루뿐이다 (0x50f28 `루 > 0`) */
export type PickoffBase = 1 | 2 | 3

/** 플레이 종류 4 = 견제 (플레이+0x118, 0x50f56 이 씀) */
export const PICKOFF_PLAY_KIND = 4
/** 견제가 들어가는 경기 상태 = 0x17 (수비 화면 인플레이) */
export const PICKOFF_GAME_STATE = 0x17
/** 견제 송구를 맡는 수비 AI 상태 = 0xe (0xb47da) */
export const PICKOFF_AI_STATE = 0xe
/** 리드 폭은 원본에 없다 — 주자는 루 좌표 위에 정확히 선다 (S8 6절 확정) */
export const RUNNER_LEAD_DISTANCE = 0

/**
 * 견제 때 루 커버 야수 = **루 번호 + 1 로 고정** (0xb28be~0xb2948: `for b = 0..3: 야수(b+1) → 루 b`).
 * 야수 칸은 0 투수 · 1 포수 · 2 1루수 · 3 2루수 · 4 3루수 · 5 유격수 (표 0xd86ec).
 *   0루(홈) → 1 포수 · 1루 → 2 1루수 · 2루 → 3 2루수 · 3루 → 4 3루수
 * 즉 **2루 견제도 늘 2루수(칸 3)** 가 받는다 — 타구 방향으로 유격수/2루수를 고르는 2루 커버 규칙(0xb1c90)은
 * 견제에는 적용되지 않는다. 원본 그대로 옮긴다.
 */
export function pickoffCoverFielderOf(base: 0 | PickoffBase): number {
  return base + 1
}

export interface PickoffInput {
  readonly base: PickoffBase
  /** 0xa9878(주자관리, 루) — 그 루에 주자가 있다 */
  readonly hasRunner: boolean
}

export interface PickoffPlay {
  /** 플레이 종류 (플레이+0x118) */
  readonly playKind: typeof PICKOFF_PLAY_KIND
  /** 경기 state[0x27] — 견제 대상 루 */
  readonly targetBase: PickoffBase
  /** 공을 받을 야수 칸 */
  readonly coverFielderSlot: number
  /** 예약되는 경기 상태 */
  readonly nextGameState: typeof PICKOFF_GAME_STATE
}

/** 0x50f28 — 루 > 0 이고 그 루에 주자가 있을 때만 견제가 걸린다. 아니면 키를 먹고 아무 일도 없다 */
export function pickoffPlayOf(input: PickoffInput): PickoffPlay | null {
  if (!input.hasRunner) return null
  return {
    playKind: PICKOFF_PLAY_KIND,
    targetBase: input.base,
    coverFielderSlot: pickoffCoverFielderOf(input.base),
    nextGameState: PICKOFF_GAME_STATE,
  }
}
