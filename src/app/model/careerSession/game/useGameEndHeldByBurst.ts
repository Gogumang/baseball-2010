import { useEffect } from 'react'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { type CareerScope, useCareerValue } from '@/app/model/careerSession/atoms/careerScope'
import { progressAtom } from '@/app/model/careerSession/atoms/gameAtoms'
import { endGameMirrorAtom, isGameEndHeldByBurstAtom } from '@/app/model/careerSession/atoms/gameEndAtoms'
import { useEndGame } from '@/app/model/careerSession/game/useEndGame'

/**
 * **돌발 결과 창 뒤의 경기 끝** — 0x12 끝(4e7ca) · 0x17 끝(52a8e)의 돌발 판정 0x8f414 가 참이면 0x1d · 0x1c(결과 창)를 먼저 거친 뒤
 * +0x1b6c 로 가고, 그 다음 상태는 0x18 · 0x19(경기 끝)일 수도 있다(R9 18-2 · R10 0x12 끝). 보상 0x8e34c 도 그 창 진입(0x3b04c ·
 * 0x3b068)이다. 웹은 내 타석 뒤 남은 반 이닝을 한 번에 돌리므로 경기가 끝나면 곧장 정산으로 가 결과 창 · 보상을 건너뛰었다(r315 —
 * 9회말 마지막 내 타석의 돌발). 판정이 남아 있으면 정산을 창을 닫을 때(`closeBurstResult`)까지 미루고, 보상이 든 커리어가
 * 그려진 뒤 정산한다(아래 고리). 재생 판 기다림이 먼저다 — 판을 다 그린 뒤(`finishReplay`) 여기로 다시 온다.
 *
 * 경기 끝(`endGame`)은 그림마다 상자에 적는다 — 이 고리와 화면을 떼는 자리가 지난 그림의 것을 부른다.
 */
export function useGameEndHeldByBurst(scope: CareerScope): void {
  const { atoms } = scope
  useMirrorRef(useCareerValue(atoms, endGameMirrorAtom), useEndGame(scope))
  const isGameEndHeldByBurst = useCareerValue(atoms, isGameEndHeldByBurstAtom)
  const progress = useCareerValue(atoms, progressAtom)
  // 돌발 결과 창을 닫아 판정이 치워졌다 — 보상이 든 커리어 · 진행이 그려진 뒤(이 커밋 뒤) 미룬 정산을 한다
  useEffect(() => {
    if (!isGameEndHeldByBurst) return
    if (progress === null || !progress.game.isFinished) return atoms.set(isGameEndHeldByBurstAtom, false)
    if (progress.lastBurstResolution !== null) return
    atoms.set(isGameEndHeldByBurstAtom, false)
    atoms.get(endGameMirrorAtom).current(progress)
  }, [atoms, isGameEndHeldByBurst, progress])
}
