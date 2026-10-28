// **장면 바로가기 표** (개발 · e2e 전용) — 도메인 파일을 모은다. 장면 하나를 더하거나 고칠 때는 그 도메인 파일만 건드린다.
// 도메인 이름은 파일 이름을 kebab 으로(`nariCareer.ts` → `nari-career`) — `yarn e2e:only --area <도메인>` · `e2e/areas/<도메인>.mjs`.
// 걸음 꼴 · 도우미는 `steps.ts`, 여러 도메인이 같이 밟는 길은 `routes.ts` · `careerRoutes.ts`.
import type { SceneDefinition } from '@/app/dev/scenes/steps'
import { MENU_SCENES } from '@/app/dev/scenes/menu'
import { NARI_SCENES } from '@/app/dev/scenes/nari'
import { OUTING_SCENES } from '@/app/dev/scenes/outing'
import { PITCHER_SCENES } from '@/app/dev/scenes/pitcher'
import { SEASON_SCENES } from '@/app/dev/scenes/season'
import { GENERAL_SCENES } from '@/app/dev/scenes/general'
import { MISSION_SCENES } from '@/app/dev/scenes/mission'
import { DERBY_SCENES } from '@/app/dev/scenes/derby'
import { NARI_CAREER_SCENES } from '@/app/dev/scenes/nariCareer'
import { PITCHER_CAREER_SCENES } from '@/app/dev/scenes/pitcherCareer'

export type { SceneDefinition, SceneStep } from '@/app/dev/scenes/steps'

export const SCENES: Readonly<Record<string, SceneDefinition>> = {
  ...MENU_SCENES,
  ...NARI_SCENES,
  ...OUTING_SCENES,
  ...PITCHER_SCENES,
  ...SEASON_SCENES,
  ...GENERAL_SCENES,
  ...MISSION_SCENES,
  ...DERBY_SCENES,
  ...NARI_CAREER_SCENES,
  ...PITCHER_CAREER_SCENES,
}
