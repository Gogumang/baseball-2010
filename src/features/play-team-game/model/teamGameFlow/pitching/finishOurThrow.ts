import type { CpuPitchOutcome } from '@/entities/pitching/model/simulateBatter'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { arrivesUnhit } from '@/features/defense-play/model/pitchArrivalPlay'
import { startDefensiveFoulPlay } from '@/features/play-team-game/model/teamGameFlow/defense/foulPlay'
import { runPendingDefensePlayNow } from '@/features/play-team-game/model/teamGameFlow/defense/resolveDefensePlay'
import { arriveOurPitchThenRest } from '@/features/play-team-game/model/teamGameFlow/pitching/ourPitchArrival'
import type { TeamPendingPitchArrival } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/** 사람 투수의 공 하나가 던져진 뒤 — 파울 각 공이면 판, 아니면 공 도착(0x3dfac) */
export function finishOurThrow(
  afterPitch: TeamGameProgress,
  thrown: CpuPitchOutcome,
  pitch: Pitch,
  random: RandomPort,
  defer: boolean,
  holdsArrival: boolean,
): TeamGameProgress {
  const { resolution, foulContact } = thrown
  // 파울 각 공 — 원본도 판(상태 0x17)을 돈다(맞은 공은 모두 메시지 0x11 → 0x13 → 0x17). 공 도착 판(0x3dfac)은 못 맞힌 공만이다
  if (foulContact !== undefined) {
    const started = startDefensiveFoulPlay(afterPitch, foulContact, random, thrown.buntKind ?? 0)
    return defer ? started : runPendingDefensePlayNow(started, random)
  }

  // 공 도착 0x3dfac — 못 맞힌 공이면 0.1% 폭투·포일(종류 9)이나 CPU 가 건 도루(종류 5) 판을 연다.
  // 우리 수비라 송구는 사람 쪽이다 — 화면이 도는 갈래(`defer`)면 판을 붙들어 키(+0x160)를 받으며 실시간으로 돌린다
  const arrivalPitch: TeamPendingPitchArrival = {
    resolution,
    outcomeAfter: afterPitch.atBat.outcome,
    // CPU 타자의 이 공 번트 종류(`simulateBatter`) — 번트 헛스윙도 0x3445a 가 쓴 종류가 남는다(0x34436~0x34464, 안 휘두르면 0x340dc 가 지운 0)
    buntKind: thrown.buntKind ?? 0,
    batterHand: pitch.stageSide,
    isUncatchable: thrown.isUncatchable,
  }
  // 화면 갈래 — 0x3dfac 은 0x12 진입 틀이다. 공이 나는 동안의 관리자 틱 굴림이 먼저 나도록 그 틀까지 붙든다 (`enterPitchResult`)
  if (holdsArrival && arrivesUnhit(resolution)) return { ...afterPitch, pendingPitchArrival: arrivalPitch }
  return arriveOurPitchThenRest(afterPitch, arrivalPitch, random, defer)
}
