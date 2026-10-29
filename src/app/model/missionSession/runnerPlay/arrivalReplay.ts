import { arrivalApplicationOf, type PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'

/**
 * 미리 돌린 공 도착 판이 재생 칸(`pickoffReplay`)에 들어가는가 — 진루만 하는 판(`continueMissionArrival` ·
 * `finishPitcherMissionArrival`)은 그릴 틱이 있고 실시간으로 안 보여 준 판이면 넣는다. 넣으면 판정 콜은 재생 화면이 기록된 틱
 * (`tickSoundIds`)에 낸다. 밀어내기 판(종류 2)도 재생하지만 콜이 없다
 */
export function missionArrivalReplayed(play: PitchArrivalPlay): boolean {
  return arrivalApplicationOf(play) === 'runnerOnly' && play.result.ticks.length > 0 && play.shownLive !== true
}

/** 판정 콜을 연 자리에서 낼 판인가 — 판이 없거나 재생 칸에 넣는 판이면 낼 콜이 없다 */
export function arrivalCallSoundIdOf(play: PitchArrivalPlay | null): number | null {
  return play === null || missionArrivalReplayed(play) ? null : play.callSoundId
}
