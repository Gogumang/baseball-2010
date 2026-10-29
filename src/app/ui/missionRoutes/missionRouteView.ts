import type { MissionRoutesProps } from '@/app/ui/missionRoutes/missionRoutesProps'
import type { MissionRouteScene } from '@/app/ui/missionRoutes/useMissionRouteScene'

/** 미션 화면 갈래가 그리는 데 쓰는 재료 — 라우트 props(치는 타자는 명예 타자를 고르면 그 타자) · 장면 칸 */
export interface MissionRouteView extends MissionRoutesProps, MissionRouteScene {
  readonly actions: MissionRoutesProps['session']['actions']
}
