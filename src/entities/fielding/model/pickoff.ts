import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { AI_STATE, type FielderState, type PlayView } from '@/entities/fielding/model/fieldingState'

/**
 * 견제 — 플레이 종류 4 (0xb28be) 와 AI 상태 0xe (0xb47da). S8 3절, 확정.
 *
 * **P2 1c 표의 "0xe → 플레이+0x127 바이트 루로" 는 오독**이었다 (S8 정정 2):
 * 실제로는 `[플레이+0x28] + 0x27` = **경기 상태 state[0x27]**(견제 대상 루)이고,
 * 상태 0xe 는 그 루로 `플레이.vt0x58(state[0x27], 0)` 송구를 부르는 네 줄짜리 분기다.
 */

/** 견제 플레이 종류 (+0x118 = 4) */
export const PICKOFF_PLAY_KIND = 4
/** 투수 칸 */
const PITCHER_SLOT = 0

/**
 * 견제에서는 **루 커버가 "루 번호 + 1" 야수로 고정**된다 (0xb2908):
 * 홈(0)→포수 1 · 1루→1루수 2 · 2루→2루수 3 · 3루→3루수 4.
 * 즉 2루 견제도 유격수가 아니라 늘 2루수(3)가 받는다 — **원본 그대로 옮길 것.**
 */
export const PICKOFF_COVER_OF_BASE: readonly number[] = [1, 2, 3, 4]

export interface PickoffStart {
  readonly play: Pick<
    PlayView,
    'kind' | 'coverOfBase' | 'ballHolderSlot' | 'everHeld' | 'held' | 'manualThrowBase'
  >
  /** 각 커버 야수가 달려갈 루 좌표 (야수 번호 → 목표점) */
  readonly coverTargets: ReadonlyMap<number, ReturnType<typeof basePosition>>
  /** 투수에게 세울 AI 상태 */
  readonly pitcherAiState: number
  /** state[0x1e] — 견제 시작이 이 칸을 세운다 */
  readonly ballOnGround: true
}

/**
 * 견제 시작 (플레이 vt 0x18 의 종류 4 가지, 0xb28be~0xb2948).
 * 투수가 공을 쥔 상태로 시작하고 야수 넷을 루로 보낸 뒤 투수를 상태 0xe 로 만든다.
 */
export function startPickoff(targetBase: number): PickoffStart {
  const coverTargets = new Map<number, ReturnType<typeof basePosition>>()
  PICKOFF_COVER_OF_BASE.forEach((slot, base) => coverTargets.set(slot, basePosition(base)))
  return {
    play: {
      kind: PICKOFF_PLAY_KIND,
      coverOfBase: [...PICKOFF_COVER_OF_BASE],
      ballHolderSlot: PITCHER_SLOT,
      everHeld: true,
      held: true,
      manualThrowBase: targetBase,
    },
    coverTargets,
    pitcherAiState: AI_STATE.PICKOFF,
    ballOnGround: true,
  }
}

/** 상태 0xe 매 틱 — state[0x27] 루로 송구한다 */
export function pickoffThrowBase(pickoffTargetBase: number): number {
  return pickoffTargetBase
}

/**
 * **주자 리드 폭은 원본에 아예 없다** (S8 6절, 확정).
 * 주자는 루 좌표(0xd78f0)에 비트까지 정확히 서고, 도루 표시가 켜진 주자만 루를 떠난다.
 * 그래서 견제사는 "리드한 주자를 잡는" 판정이 아니라 **귀루 vs 송구** 의 도착 틱 싸움이다.
 */
export const RUNNER_LEAD_DISTANCE = 0

/** 견제로 루를 지키는 야수인가 */
export function isPickoffCover(fielder: FielderState, base: number): boolean {
  return PICKOFF_COVER_OF_BASE[(((base % 4) + 4) % 4)] === fielder.slot
}
