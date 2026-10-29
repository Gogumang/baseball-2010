import type { PitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import type { PitcherLeagueRouteProps } from '@/app/ui/pitcherLeagueRoute/pitcherLeagueRouteProps'
import type { PitcherScreenState } from '@/app/ui/pitcherLeagueRoute/usePitcherScreenState'

/** 투수편 장면 갈래가 그리는 데 쓰는 재료 — 라우트 props · 세션 칸 · 같이 보는 칸 */
export interface PitcherBranchInput extends Omit<PitcherLeagueRouteProps, 'openedHiddenIds'>, PitcherScreenState {
  readonly openedHiddenIds: readonly number[]
  /** 커리어가 선 뒤의 갈래만 온다 — 없으면 등록이 먼저 받는다 */
  readonly career: NonNullable<PitcherLeagueSession['career']>
  readonly scene: PitcherLeagueSession['scene']
  readonly gameOptions: PitcherLeagueSession['gameOptions']
  readonly shopTab: PitcherLeagueSession['shopTab']
  readonly shopNotice: PitcherLeagueSession['shopNotice']
  readonly shopGpDetail: PitcherLeagueSession['shopGpDetail']
  readonly actions: PitcherLeagueSession['actions']
}
