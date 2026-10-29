import type { Screen } from '@/app/model/screen'
import type { CareerRoutesProps } from '@/app/ui/careerRoutes/careerRoutesProps'
import type { CareerScreenState } from '@/app/ui/careerRoutes/useCareerScreenState'

/** 화면 갈래 하나가 받는 화면 — 그 갈래의 `kind` 로 좁힌 것 */
export type ScreenOf<K extends Screen['kind']> = Extract<Screen, { readonly kind: K }>

/** 나리 화면 갈래가 그리는 데 쓰는 재료 — 라우트 props · 같이 보는 칸 */
export interface CareerScreenInput extends CareerRoutesProps, CareerScreenState {
  readonly actions: CareerRoutesProps['session']['actions']
  /** 관리 화면(105)으로 */
  readonly backToManagement: () => void
}
