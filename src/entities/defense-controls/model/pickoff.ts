/**
 * 견제 — binary.mod 0x53548(입력) · 0x50f28(메시지 0x10) · 0xb28be(플레이 시작) · 0xb47da(AI 상태 0xe).
 *
 * 견제는 따로 "아웃 확률" 식이 없다. 그냥 **수비 화면의 송구 시뮬레이션**(플레이 종류 4)을 한 판 돌려
 * 주자 귀루와 공 중 어느 쪽이 빠른지로 판정한다 (I-controls.md 4a — 0x10 가지에 난수가 없는 것까지 확인).
 *
 * **주자 리드 폭이라는 값은 원본에 아예 없다** (S8-fielding-ai-3.md 6절, 확정).
 * 주자는 루 좌표(0xd78f0)에 비트까지 정확히 서 있고, 루에 오프셋을 더하는 코드가 주자·야수 어느 쪽에도 없다.
 * 견제 시작 0xb28be 도 야수 넷만 루로 보내고 주자에게는 아무 호출도 하지 않는다.
 *
 * ## CPU 도 같은 문을 쓴다 — 0x34848 (2026-09 확정)
 * CPU 투수의 "목표 종류 4"는 투구가 아니라 **견제**다: `rand(1,4)` 를 주자 있는 루가 나올 때까지
 * 다시 굴려 그 루로 **메시지 0x10** 을 보낸다. 고르는 쪽은 `entities/pitching/model/pitchTarget.ts`
 * 의 `isCpuPickoff` · `cpuPickoffBaseOf` 에 옮겨 두었고, 나온 루를 아래 `pickoffPlayOf` 에 넣으면
 * 사람 견제와 **완전히 같은 경로**가 된다. 가중치표 w4 가 주자가 있을 때 3(%) 이므로
 * **주자가 있는 투구의 3% 가 견제**다.
 *
 * ## 견제가 오면 주자는 곧바로 제 루로 (0x4677a~0x467aa, 확정)
 * 상태 0x17 진입 `0x46418` 안에서 `플레이[+0x118] == 4` 이면 주자 4칸을 훑어
 * 끝나지 않은(`주자+0x78+0x1e == 0`) 주자마다 `주자.vt0x48([주자+0x78+0x14])` = `vt0x48(+0x8c)`,
 * 곧 **마지막으로 닿은 루**로 목표를 되돌린다. 난수도 능력치 판단도 없다 (Q1 3b).
 * 그런데 주자는 리드가 없어 이미 그 루 위에 비트까지 정확히 서 있으므로 이것은 **제자리 명령**이다.
 *
 * ## 아웃·세이프와 효과음이 가는 곳 (확정)
 * - 아웃: 견제 전용 판정이 없다. 아웃 판정 `0xb36d0`(= `entities/fielding/model/outJudgement`) 이
 *   그대로 돈다 — 플레이 종류 거르개 비트표 `0x58d`(종류 0·2·3·7·8·10 만 건너뜀)에 **4 는 없다**.
 *   주자가 루에 붙어 멈춰 있으면 태그(3a)·포스(2a) 두 갈래가 모두 `주자.vt18() 거짓`(= 움직이는 중)을
 *   요구하므로 **아웃이 안 난다**. 곧 도루 표시가 켜져 루를 떠난 주자만 견제사한다.
 *   아웃이 나면 결과 코드 13 → 아웃 콜 62/20 (`play-at-bat/model/atBatSounds.inPlayCallSoundIdOf`).
 * - 세이프: 결과 코드 9 → `0x51c14`. 그 머리 세 줄이 **플레이 종류 4(견제)·5(주자만)를 따로 빼서**
 *   다른 검사 없이 곧장 `movs r1,#0x11` 로 간다 —
 *   ```
 *   51c14: ldr r3,[[r4]+0x118] ; 51c1e: cmp #4 → beq 51c38 ; 51c22: cmp #5 → beq 51c38
 *   51c38: r1 = 0x11 (17 "Safe!") → 0x51b18
 *   ```
 *   곧 **견제가 아웃 없이 끝나면 언제나 소리 17**이다 (`shared/config/original/sounds` id 17).
 */

import { pickoffCommandOf } from '@/entities/defense-controls/model/defenseKeys'

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

/**
 * **키 한 번 → 견제 플레이** — 입력(0x53548)부터 메시지 0x10 처리(0x50f28)까지를 한 줄로 잇는다.
 * 화면은 **경기 상태 0xf(구질 고르기)에서 사람이 수비일 때만** 이 함수에 키를 넘기면 된다.
 *
 * 돌려주는 것이 `null` 이 아니면 그대로 수비 화면(상태 0x17)을 플레이 종류 4 로 열면 된다 —
 * 원본에는 별도 "견제 아웃 확률" 이 없고, 주자 귀루 대 송구의 시뮬레이션이 판정 전부다 (I-controls 4a).
 */
export function pickoffPlayForKey(
  webKey: string,
  hasRunnerOnBase: (base: PickoffBase) => boolean,
): PickoffPlay | null {
  const command = pickoffCommandOf(webKey)
  if (command === null) return null
  return pickoffPlayOf({ base: command.base, hasRunner: hasRunnerOnBase(command.base) })
}
