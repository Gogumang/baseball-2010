import { CAUGHT_OUT_CALL, FORCE_OUT_CALL, SAFE_CALL } from '@/features/defense-play/model/pickoff/constants'
import { PICKOFF_RESULT, type PickoffPlayResult } from '@/features/defense-play/model/pickoff/types/pickoffTypes'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'

/**
 * 견제가 끝난 뒤의 콜 — 결과 9 면 **늘 17**(0x51c14 의 종류 4·5 갈래), 13 이면 62/20(0x51b36).
 * 견제사는 포스가 걸릴 일이 없어 언제나 태그(결과 3 → state[0x87] = 1)라 사실상 62 다.
 * 결과 코드가 안 섰으면(악송구 근사) 소리도 없다.
 */
export function pickoffCallSoundIdOf(result: Pick<PickoffPlayResult, 'resultCode' | 'tagOut'>): number | null {
  if (result.resultCode === PICKOFF_RESULT.SAFE) return SAFE_CALL
  if (result.resultCode === PICKOFF_RESULT.OUT) return result.tagOut ? CAUGHT_OUT_CALL : FORCE_OUT_CALL
  return null
}

/** 재생 칸(`lastDefensePlay`)에 든 결과가 견제 판인가 — 타구 결과에는 `resultCode` 가 없다 */
export function isPickoffPlayResult(result: DefensePlayResult | null): result is PickoffPlayResult {
  return result !== null && 'resultCode' in result && 'targetBase' in result
}
