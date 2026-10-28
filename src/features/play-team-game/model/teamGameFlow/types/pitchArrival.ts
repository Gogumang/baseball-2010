import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/** 공 도착 한 걸음의 결과 */
export interface TeamPitchArrival {
  readonly progress: TeamGameProgress
  /** 열린 주자 판 (종류 9 폭투·포일 · 종류 5 도루). 없으면 null */
  readonly play: PitchArrivalPlay | null
  /** 판에서 반 이닝·경기가 끝나 이 타석이 끊겼다 — 타석 결과를 먹이지 말고 `advance` 로 다음 타석을 세운다 */
  readonly interrupted: boolean
  /** 사람 수비의 판을 실시간으로 돌리려고 붙들었다(`pendingRunnerPlay`) — 부르는 쪽은 그대로 돌려준다 */
  readonly deferred?: boolean
}
