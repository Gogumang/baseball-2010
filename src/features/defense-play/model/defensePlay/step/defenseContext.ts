import type { DefenseContext } from '@/entities/fielding/model/fieldingState'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

export function contextAt(s: DefensePlayState, at: number): DefenseContext {
  return {
    play: s.play,
    fielders: s.fielders,
    runners: s.runners.map((runner) => runner.state),
    currentTick: at,
    landingTick: s.trajectory.landingTick,
  }
}
