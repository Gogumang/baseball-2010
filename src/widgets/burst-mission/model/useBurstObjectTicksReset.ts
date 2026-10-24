import { useState } from 'react'
import { resetBurstObjectTicks } from '@/widgets/burst-mission/lib/burstMissionWindowLayout'

/**
 * 경기 화면이 붙을 때 돌발 객체 [+0x224] 를 0 으로 둔다 — 경기 장면 생성 0x48658 이 새 객체를 만드는 때(`burstObjectTicks`).
 * 화면 맨 위에서 한 번 부른다(붙는 그림에 한 번 — 창보다 먼저).
 */
export function useBurstObjectTicksReset(): void {
  useState(() => {
    resetBurstObjectTicks()
    return null
  })
}
