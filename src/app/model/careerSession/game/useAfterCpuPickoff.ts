import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { isPickoffPlayResult, pickoffCallSoundIdOf } from '@/features/defense-play/model/pickoffPlay'
import { replayCallsOnScreen } from '@/features/defense-play/model/judgeCall'
import { EMPTY_AT_BAT_PITCH_TALLY } from '@/features/play-at-bat/model/atBatPitchTally'
import { gameStepSoundIdsOf } from '@/features/play-game/model/gameSounds'
import { playSoundIds } from '@/app/model/useSound'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { pitchTallyAtom } from '@/app/model/careerSession/atoms/gameAtoms'
import { useEndGame } from '@/app/model/careerSession/game/useEndGame'

/** 견제 판에서 반 이닝이 끝났거나(3아웃) 경기가 끝났다(끝내기 득점) — 내 타석이 끊긴다 */
const isAtBatInterrupted = (current: GameProgress, next: GameProgress) =>
  next.game.isFinished || next.game.inning !== current.game.inning || next.game.half !== current.game.half

/**
 * CPU 견제 판을 먹인 뒤 — 판정 콜과 판에서 끊긴 타석. 세이프면 늘 17 (0x51c14 의 종류 4·5 갈래), 견제사면 62/20 (0x51b36).
 * 원본은 결과 코드가 선 플레이 틱(메시지 0xbba)에 낸다 — 화면이 실시간으로 돌린 판은 그 틱에 이미 냈으므로(`callShown`) 안 내고,
 * 미리 돌려 재생 칸에 넣은 판은 재생 화면이 기록된 틱에 낸다. (그림마다 새 함수 — 옛 꼴 그대로)
 */
export function useAfterCpuPickoff(scope: CareerScope) {
  const { atoms, audio, runner } = scope
  const endGame = useEndGame(scope)
  return (current: GameProgress, next: GameProgress, play: DefensePlayResult | null, callShown = false) => {
    // 미리 돌려 재생 칸에 새로 넣은 판은 재생 화면이 기록된 틱에 낸다(`replayCallsOnScreen`)
    const replayed = replayCallsOnScreen(current.lastDefensePlay, next.lastDefensePlay, play)
    const isCallHere = !callShown && !replayed && isPickoffPlayResult(play)
    playSoundIds(audio, [isCallHere ? pickoffCallSoundIdOf(play) : null, ...gameStepSoundIdsOf(current, next)])
    if (!isAtBatInterrupted(current, next)) return
    // 다음 내 타석은 새 볼카운트·새 파울 카운터로 (타석 초기화 0xa5bcc)
    atoms.set(pitchTallyAtom, EMPTY_AT_BAT_PITCH_TALLY)
    runner.resetAtBat()
    if (next.game.isFinished) endGame(next)
  }
}
