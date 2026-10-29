import { isPickoffPlayResult, pickoffCallSoundIdOf } from '@/features/defense-play/model/pickoffPlay'
import { replayCallsOnScreen } from '@/features/defense-play/model/judgeCall'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'

/**
 * 이번 걸음에 공 도착 판(0x3dfac — 종류 9·5)이 새로 열렸으면 그 판정 콜. 원본은 판 안의 결과 코드가 선 틱(메시지 0xbba)에 낸다 —
 * 재생 칸에 들어가 화면이 재생할 판은 화면이 그 틱에 낸다(`replayCallsOnScreen`). 재생하지 않는 판만 판을 연 이 자리에서 낸다(근사)
 */
export function arrivalCallSoundIdOf(before: TeamGameProgress, after: TeamGameProgress): number | null {
  const play = after.lastArrivalPlay
  if (play === null || play === before.lastArrivalPlay) return null
  return replayCallsOnScreen(before.lastDefensePlay, after.lastDefensePlay, play.result) ? null : play.callSoundId
}

/** 견제 판이 새로 열렸으면 그 판정 콜 하나 — 재생 칸에 들어간 판(재생할 틱이 있는 판)은 재생 화면이 그 틱에 낸다 */
export function pickoffCallSoundsOf(before: TeamGameProgress, after: TeamGameProgress): readonly (number | null)[] {
  const play = after.lastDefensePlay
  if (play === before.lastDefensePlay || !isPickoffPlayResult(play)) return []
  return replayCallsOnScreen(before.lastDefensePlay, play, play) ? [] : [pickoffCallSoundIdOf(play)]
}
