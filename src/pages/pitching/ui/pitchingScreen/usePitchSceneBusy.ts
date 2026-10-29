import { useState } from 'react'
import { passesHeldResult, pitchSceneBusyTicksOf } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import type { PitchingStageSource } from './pitchingScreenProps'

type LastThrow = PitchingStageSource['lastThrow']

/** 놓은 뒤 남은 비행 + 0x12 대기 틱 — 판정을 붙드는 공만 센다 */
const busyTicksOf = (lastThrow: LastThrow): number =>
  lastThrow !== null && passesHeldResult(lastThrow.resolution) ? pitchSceneBusyTicksOf(lastThrow.pitch.frameCount, lastThrow.resultTicks) : 0

/**
 * 공이 날거나 0x12 인 동안 남은 틱 — 원본은 그동안 상태 0x11 · 0x12 라 다음 공의 구질 키 · 견제 · 0xe 의 OK 를 안 받는다.
 * 세션은 놓는 순간 판정까지 내므로 놓은 뒤 남은 비행 + 0x12 대기를 센다 (`pitchSceneBusyTicksOf`). 장면이 없으면 0.
 * 판이 섰지만 아직 0x17 전(0x11 끝 · 0x13 · 공 도착 판의 0x12 틱 0)도 0x11 · 0x12 · 0x13 이다
 */
export function usePitchSceneBusy(stage: PitchingStageSource | undefined, isPopupOpen: boolean): boolean {
  const lastThrow = stage?.lastThrow ?? null
  const [busyTicks, setBusyTicks] = useState(0)
  const [busyThrow, setBusyThrow] = useState(lastThrow)
  if (busyThrow !== lastThrow) {
    setBusyThrow(lastThrow)
    setBusyTicks(busyTicksOf(lastThrow))
  }
  useSceneTick(() => setBusyTicks((left) => Math.max(0, left - 1)), busyTicks > 0 && !isPopupOpen)
  return busyTicks > 0 || stage?.isBeforePlay === true
}
