import { useMemo } from 'react'
import { playSoundIds } from '@/shared/api/audio/soundPort'
import { gameResultSoundIdOf } from '@/features/play-game/model/gameSounds'
import {
  closeBurstWindow,
  closeManagerHookWindow,
  confirmScene,
  enterBenchClearing,
  giveUpPitching,
  judgeHitByPitch,
  pickoff,
  resolveBenchClearing,
  returnToPitchSelection,
  summaryOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { pickoffCallSoundsOf } from './callSounds'
import type { PitcherActionContext } from './pitcherGameStep'

/** 장면 흐름의 손잡이 — 견제 · 0xe OK · 조준 CLR · 강판 · 감독 창 · 돌발 · 사구 벤치 클리어링 · 정산 진입 */
export function useSceneActions({ step, random, audio, progressRef }: PitcherActionContext) {
  return useMemo(
    () => ({
      // 견제 판은 붙들어 수비 화면이 실시간으로 돌린다(송구 키 +0x160) — 콜은 화면이 판 안의 그 틱에 낸다 (`pickoffCallSoundsOf`)
      pickoff: (key: string) => step((progress) => pickoff(progress, key, random, true), pickoffCallSoundsOf),
      confirmScene: () => step((progress) => confirmScene(progress, random)),
      returnToPitchSelection: () => step((progress) => returnToPitchSelection(progress, random)),
      giveUp: () => step((progress) => giveUpPitching(progress, random)),
      confirmManagerHook: () => step((progress) => closeManagerHookWindow(progress, random)),
      closeBurst: () => step((progress) => closeBurstWindow(progress)),
      judgeHitByPitch: () => step((progress) => judgeHitByPitch(progress, random)),
      enterBenchClearing: () => step((progress) => enterBenchClearing(progress, random)),
      finishBenchClearing: (reachedTargetTick: boolean) => step((progress) => resolveBenchClearing(progress, { reachedTargetTick }, random)),
      enterSettlement: () => {
        const finished = progressRef.current
        if (!finished.game.isFinished) return
        // 무승부는 동점이면 측 0 을 이긴 칸으로 보는 0xb6a0c 그대로 — 사람이 선공이면 31, 후공이면 32
        playSoundIds(audio, [gameResultSoundIdOf(summaryOf(finished).result, finished.game.playerSide)])
      },
    }),
    [step, random, audio, progressRef],
  )
}
