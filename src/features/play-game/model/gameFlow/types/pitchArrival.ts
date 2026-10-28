import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/** 공 도착 한 걸음의 결과 */
export interface PitchArrivalStep {
  readonly progress: GameProgress
  /** 열린 주자 판 (종류 9 폭투·포일 · 종류 5 도루). 없으면 null */
  readonly play: PitchArrivalPlay | null
  /** 판에서 반 이닝·경기가 끝나 이 타석이 끊겼다 — 타석 결과를 먹이지 말고 타석을 새로 시작한다 */
  readonly interrupted: boolean
  /**
   * 판을 붙들었다(`pendingRunnerPlay`) — 화면이 사람 주루 키를 받으며 돌리고 `resolveRunnerPlay` 가 이 걸음의 나머지를 낸다.
   * 그때까지 타석 결과를 먹이지 않는다
   */
  readonly deferred?: boolean
}
