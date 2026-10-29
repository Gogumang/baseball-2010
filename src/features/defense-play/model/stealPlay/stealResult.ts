import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { RUNNER_PLAY_RESULT, type RunnerPlayEngineResult } from '@/features/defense-play/model/runnerPlayEngine'
import type { StealPlayInput, StealPlayResult } from '@/features/defense-play/model/stealPlay/stealPlayTypes'

/** 판 끝 정리 — 잡힌 · 루를 옮긴 도루 주자 (정산 0xa8024 @a83c6 · @a83de 가 본다) */
export function stealPlayResultOf(input: StealPlayInput, result: RunnerPlayEngineResult): StealPlayResult {
  const stolenFrom: StealBase[] = []
  const caughtFrom: StealBase[] = []
  result.runnerFates.forEach((fate) => {
    const from = fate.fromBase
    if (from !== 1 && from !== 2 && from !== 3) return
    if (!input.stealingFrom.includes(from)) return
    if (fate.retired && !fate.scored) caughtFrom.push(from)
  })
  // 잡히지 않은 도루 주자는 다음 루 이상에 닿았다 — 목표 루에 닿기 전엔 판이 안 끝난다
  for (const from of input.stealingFrom) {
    if (caughtFrom.includes(from)) continue
    stolenFrom.push(from)
  }
  return { ...result, stealingFrom: [...input.stealingFrom], stolenFrom, caughtFrom }
}

/**
 * 도루 판이 끝난 뒤의 콜 — 결과 9 면 **늘 17**(0x51c14 머리 세 줄이 종류 4·5 를 따로 빼 다른 검사 없이 17),
 * 13 이면 state[0x87](마지막 판정이 태그) 이 서 있으니 62, 아니면 20 (0x51b36). 결과 코드가 없으면 소리도 없다.
 */
export function stealCallSoundIdOf(result: Pick<StealPlayResult, 'resultCode' | 'tagOut'>): number | null {
  if (result.resultCode === RUNNER_PLAY_RESULT.SAFE) return SAFE_CALL
  if (result.resultCode === RUNNER_PLAY_RESULT.OUT) return result.tagOut ? CAUGHT_OUT_CALL : FORCE_OUT_CALL
  return null
}

const SAFE_CALL = 17
const CAUGHT_OUT_CALL = 62
const FORCE_OUT_CALL = 20

/** 재생 칸에 든 결과가 도루 판인가 */
export function isStealPlayResult(result: DefensePlayResult | null): result is StealPlayResult {
  return result !== null && 'stealingFrom' in result && 'resultCode' in result
}
