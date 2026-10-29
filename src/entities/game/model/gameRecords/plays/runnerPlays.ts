import { PLAY_RECORD } from '@/entities/game/model/gameRecords/plays/playRecordIds'

/** 주자 플레이 정산에서 보는 주자 한 명 (0xa9565(i) 의 주자 객체) */
export interface StealPlayRunner {
  /** 그 주자가 선 루에서 도루를 걸었는가 (state[0x14 + 출발 루] ≠ 0) */
  readonly stealStarted: boolean
  /** 출발 루 (r+0x90) */
  readonly fromBase: number
  /** 지금 루 (r+0x8c) */
  readonly currentBase: number
  /** 목표 루 — r+0x80 · r+0x84 중 큰 것 */
  readonly targetBase: number
  /** 플레이가 끝났는가 (r+0x96) */
  readonly finished: boolean
  /** 세이프·득점했는가 (r+0x95) */
  readonly safe: boolean
}

/**
 * 8 도루 성공 · 24 도루 저지 — 0xa8024 @a83c6 · @a83de (0xa8268~0xa83e2 확인).
 * 플레이 종류 state[0x26] == 5(주자 플레이)인 정산에서만 본다.
 *   (가) 도루를 걸고 다음 루(출발+1 == 목표)를 노린 주자가 끝났는데 세이프가 아니면 → 24 **한 번** 주고 끝
 *       (둘을 잡아도 1회, 그리고 (나)를 건너뛴다)
 *   (나) 아무도 안 잡혔으면 도루를 걸었고 루가 바뀐(출발 ≠ 지금) 주자**마다** 8
 * 한 명이라도 잡히면 나머지가 살아도 8 은 없다. 게이트상 8 은 사람 공격, 24 는 사람 수비 때만 남는다.
 * 간이 엔진의 자동 도루(0xc1818 끝)는 0xa77f0 을 부르지 않는다 → 동료 타석 자동 도루에는 붙이지 말 것.
 * 배선: gameFlow.ts `stealBase` — 성공 갈래는 runners 하나(출발 ≠ 지금)로 8, 실패 갈래는 잡힌 주자로
 *   24 후보 → 사람 공격이라 `passesRecordTeamGate` 에서 버린다.
 *   24 가 실제로 쌓이는 곳은 사람 수비 화면(투수편·팀 경기의 CPU 도루 수비)이다.
 */
export function stealPlayRecordIdsOf(input: {
  /** 정산 때 플레이 종류가 5(주자 플레이)인가 (state[0x26] == 5) */
  readonly isRunnerPlay: boolean
  readonly runners: readonly StealPlayRunner[]
}): number[] {
  if (!input.isRunnerPlay) return []
  const caught = input.runners.some((runner) => runner.stealStarted && runner.fromBase + 1 === runner.targetBase && runner.finished && !runner.safe)
  if (caught) return [PLAY_RECORD.caughtStealing]
  return input.runners.filter((runner) => runner.stealStarted && runner.fromBase !== runner.currentBase).map(() => PLAY_RECORD.stolenBase)
}
