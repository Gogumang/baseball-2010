import { useMemo } from 'react'
import { autoRelayModeSlotOf, autoRelayRecordPort } from '@/entities/mode-save/model/autoRelayRecord'
import { playSoundIds } from '@/shared/api/audio/soundPort'
import { gameResultSoundIdOf } from '@/features/play-game/model/gameSounds'
import {
  cancelSubstitution,
  changePitcher,
  closeBurstWindow,
  confirmScene,
  enterBenchClearing,
  judgeHitByPitch,
  pickoff,
  pinchHit,
  resolveBenchClearing,
  returnToPitchSelection,
  runAutoProgress,
  stepAutoRelay,
  stopAutoRelay,
  summaryOf,
} from '@/features/play-team-game/model/teamGameFlow'
import { pickoffCallSoundsOf } from './callSounds'
import type { TeamActionContext } from './teamGameStep'

/** 장면 흐름의 손잡이 — 0xe OK · 교체 창 · 견제 · 돌발 · 자동진행 중계 · 사구 벤치 클리어링 · 정산 진입 */
export function useSceneActions({ step, random, audio, progressRef }: TeamActionContext) {
  return useMemo(
    () => ({
      // 판정 콜 — 세이프면 늘 17 (0x51c14 의 종류 4·5 갈래), 견제사면 62/20 (0x51b36). 원본은 결과 코드가 선 **틱**에 낸다 —
      // 사람 견제는 판을 붙들고 수비 화면이 실시간으로 돌리며 그 틱에 내고(송구 키 +0x160 · `playRunnerTickSounds`), 미리 돌려 재생 칸에 넣은
      // 판은 재생 화면이 기록된 틱에 낸다. 재생하지 않는 판만 판을 연 자리에서 낸다(`pickoffCallSoundsOf`)
      pickoff: (key: string) => step((progress) => pickoff(progress, key, random, true), pickoffCallSoundsOf),
      closeBurst: () => step((progress) => closeBurstWindow(progress)),
      // 교체 연출(상태 0x16)을 지나 상태 0xe 로 오면 등판음이 예약된다 (0x38b64 → 0x38c34) — 화면이 "CHANGE" 애니를 다 그린 뒤
      // `substitutionScene.entrySoundId`(마투수 26 · 2·3루 주자 15 · 그 밖 14)로 낸다 (`useSubstitutionScene`)
      changePitcher: (benchIndex: number) => step((progress) => changePitcher(progress, benchIndex)),
      pinchHit: (benchIndex: number) => step((progress) => pinchHit(progress, benchIndex)),
      // 0xe 의 OK → 메시지 1(돌발 0x8f158) → 0xf 진입 0x3d954 (CPU 교체면 22 → 0x16 → 0xe 등판음 — `step` 이 낸다)
      confirmScene: () => step((progress) => confirmScene(progress, random)),
      // 교체 창 취소('#'·CLR → 상태 0xe) — 다시 선 0xe 의 OK 뒤에 돌발 굴림과 0xf 진입 0x3d954 가 돈다
      cancelSubstitution: () => step((progress) => cancelSubstitution(progress)),
      // 코스 고르기(0x10)의 CLR → 0xf (0x50ee6) — 0xf 진입 0x3d954 가 다시 돈다
      returnToPitchSelection: () => step((progress) => returnToPitchSelection(progress, random)),
      autoProgress: () => {
        // 3c94a 0xc0ea8(sim, 0) — sim+0x9f = 0 을 전역기록 +0x14d + m 에도 쓴다
        const after = step((progress) => runAutoProgress(progress, random))
        if (after.autoProgressFlag === 'running') autoRelayRecordPort().setStopped(autoRelayModeSlotOf(after.options.mode), false)
      },
      stepAutoRelay: () => step((progress) => stepAutoRelay(progress, random)).autoRelay ?? null,
      stopAutoRelay: () => {
        // 52cac 0xc0ea8(sim, 1) — sim+0x9f = 1 을 전역기록 +0x14d + m 에도 쓴다
        const after = step((progress) => stopAutoRelay(progress))
        if (after.autoProgressFlag === 'stopped') autoRelayRecordPort().setStopped(autoRelayModeSlotOf(after.options.mode), true)
      },
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
