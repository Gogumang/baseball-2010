import { useEffect, useEffectEvent, useRef, type Dispatch, type SetStateAction } from 'react'
import { stepSeasonScoreboardX } from '@/widgets/batting-stage/lib/renderScenery'
import type { stadiumPreviewOf } from '@/entities/season-mode/model/stadiumItems'

/** 상점 그리기 0xb1f8 — 구장을 그린 **뒤** 0x77fb5(구장, 1) 로 +0x8c 를 한 칸 흘린다(b24e). 갱신 한 번에 그리기 한 번 */
export function useScoreboardStep(
  tick: number,
  isShop: boolean,
  board: ReturnType<typeof stadiumPreviewOf>['board'],
  setScoreboardX: Dispatch<SetStateAction<number>>,
) {
  const steppedTick = useRef(tick)
  const stepScoreboard = useEffectEvent((steps: number) => {
    if (isShop && steps > 0) setScoreboardX((held) => stepSeasonScoreboardX(held, board, steps))
  })
  useEffect(() => {
    const steps = tick - steppedTick.current
    steppedTick.current = tick
    stepScoreboard(steps)
  }, [tick])
}
