import { type PitchArrivalPlay, arrivalApplicationOf } from '@/features/defense-play/model/pitchArrivalPlay'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { ARRIVAL_PLAY_KIND, type StealArrivalPlay } from '@/features/play-team-game/model/teamGameFlow/types/plays'

/** 이 공이 연 판이 **삼진과 한 정산**인 도루 판이면 그 판 — 판정 B 0xae3e8 의 ae576 갈래(종류 5 && state[0xc] == 5) */
export function stealPlayWithStrikeoutOf(arrival: PitchArrivalPlay | null | undefined, outcome: AtBatOutcome): StealArrivalPlay | undefined {
  return arrival != null && arrival.kind === ARRIVAL_PLAY_KIND.도루 && outcome.kind === '삼진' ? arrival : undefined
}

/**
 * 이 공이 연 판이 **삼진 그대로인 폭투·포일 판**(종류 9 `strikeoutStands`)이면 그 판 — 판정 B 의 ae596 갈래(종류 9 && state[0xc] == 5
 * → 0xd · 정산). 낫아웃(`batterRuns`)은 그 판이 곧 타석의 진루라 따로 간다.
 */
export function wildPitchWithStrikeoutOf(arrival: PitchArrivalPlay | null | undefined, outcome: AtBatOutcome): PitchArrivalPlay | undefined {
  return arrival != null && arrival.kind === ARRIVAL_PLAY_KIND.폭투포일 && arrival.strikeout === 'strikeoutStands' && outcome.kind === '삼진'
    ? arrival
    : undefined
}

/** 이 공이 연 판이 **낫아웃 판**이면 그 판 — 폭투·포일 판의 진루(타자주자 포함)가 곧 이 삼진 타석의 진루다 (0x3e0d0 state[0x1a]) */
export function droppedThirdStrikeArrivalOf(arrival: PitchArrivalPlay | null): PitchArrivalPlay | undefined {
  return arrival !== null && arrivalApplicationOf(arrival) === 'batterRuns' ? arrival : undefined
}

/** 볼넷 · 사구가 연 밀어내기 판(종류 2) — 진루는 보통 길과 같고 재생만 한다 */
export function freePassArrivalResultOf(arrival: PitchArrivalPlay | null): PitchArrivalPlay['result'] | null {
  return arrival !== null && arrivalApplicationOf(arrival) === 'freePass' ? arrival.result : null
}

export function describeArrivalPlay(play: PitchArrivalPlay, humanOffense: boolean): string {
  const runs = play.result.advance.runsScored
  const tail = runs > 0 ? ` (${runs}${humanOffense ? '점' : '실점'})` : ''
  const who = humanOffense ? '' : '상대 '
  if (play.kind === ARRIVAL_PLAY_KIND.폭투포일) return `폭투·포일${tail}`
  if (play.kind === ARRIVAL_PLAY_KIND.밀어내기) return `밀어내기${tail}`
  if (play.result.caughtFrom.length > 0) return `${who}도루 실패 — 아웃${tail}`
  if (play.result.stolenFrom.length > 0) return `${who}도루 성공${tail}`
  return `${who}도루${tail}`
}
