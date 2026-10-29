import { isPickoffPlayResult, pickoffCallSoundIdOf } from '@/features/defense-play/model/pickoffPlay'
import { replayCallsOnScreen } from '@/features/defense-play/model/judgeCall'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'

/**
 * 공 도착 0x3dfac 가 연 판의 판정 콜 — 도루 · 폭투 판은 붙들어(`live`) 화면이 판 안의 그 틱에 내므로 여기서는 `lastArrivalPlay` 가
 * 밀어내기(콜 없음)일 때만 바뀐다. 미리 돌려 재생 칸에 넣은 판은 재생 화면이 기록된 틱에 내고(`replayCallsOnScreen`), 재생하지 않는 판만
 * 연 자리에서 낸다(근사)
 */
export function arrivalCallSoundIdOf(before: PitcherGameProgress, after: PitcherGameProgress): number | null {
  const play = after.lastArrivalPlay
  if (play === null || play === before.lastArrivalPlay) return null
  return replayCallsOnScreen(before.lastDefensePlay, after.lastDefensePlay, play.result) ? null : play.callSoundId
}

/**
 * 견제 판정 콜 — 세이프면 늘 17 (0x51c14 의 종류 4·5 갈래), 견제사면 62/20 (0x51b36). 붙든 판은 `lastDefensePlay` 가 안 바뀌어
 * 여기서는 안 난다(화면 `LiveRunnerPlayback` 이 결과 메시지 0xbba 의 틱에 낸다). 미리 돌려 재생 칸에 넣은 판은 재생 화면이
 * 기록된 틱에 낸다(`replayCallsOnScreen`) — 재생할 틱이 없는 판만 연 자리에서 낸다
 */
export function pickoffCallSoundsOf(before: PitcherGameProgress, after: PitcherGameProgress): readonly (number | null)[] {
  const play = after.lastDefensePlay
  if (play === before.lastDefensePlay || !isPickoffPlayResult(play)) return []
  return replayCallsOnScreen(before.lastDefensePlay, play, play) ? [] : [pickoffCallSoundIdOf(play)]
}
