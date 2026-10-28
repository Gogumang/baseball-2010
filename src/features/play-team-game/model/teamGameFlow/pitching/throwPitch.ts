import type { RandomPort } from '@/shared/api/random/randomPort'
import { pitchOnce } from '@/features/play-team-game/model/teamGameFlow/pitching/pitchOnce'
import type { TeamPitchInput } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 공 하나를 던진다 (상태 0x10 확정 → 0x11 → 0x12/0x13).
 * 투수편 `pitcherGameFlow.throwPitch` 와 같은 순서다 — 상대 타자는 CPU 가 반응한다.
 *
 * ⚠️ 수비 화면을 띄우는 화면은 `startThrowPitch` 를 쓴다 — 이쪽은 타구까지 미리 다 돌려 버린다.
 */
export function throwPitch(progress: TeamGameProgress, input: TeamPitchInput, random: RandomPort): TeamGameProgress {
  return pitchOnce(progress, input, random, false)
}

/**
 * 같은 공 하나지만, 인플레이 타구가 나오면 **송구를 사람이 잡도록 거기서 멈춘다**
 * (`pendingDefensePlay` 에 얹는다). 화면이 다 돌면 `resolveDefensePlay` 를 부르면 된다.
 */
export function startThrowPitch(
  progress: TeamGameProgress,
  input: TeamPitchInput,
  random: RandomPort,
  /**
   * 화면 갈래 — 못 맞힌 공의 공 도착 0x3dfac 을 0x12 진입 틀까지 붙든다(`pendingPitchArrival`). 부르는 쪽이 그 틀
   * (놓은 틀에서 `pitchResultEntryDelayTicksOf` 뒤)에 `enterPitchResult` 를 부른다. 안 주면 예전처럼 놓는 걸음에 다 돌린다
   */
  holdsArrival = false,
): TeamGameProgress {
  return pitchOnce(progress, input, random, true, holdsArrival)
}
