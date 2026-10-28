// 장면 표 — 외출 지도 — 나리 타자편 112 · 시즌모드 0xd1. 도메인 이름은 파일 이름(`yarn e2e:only --area <도메인>`).
import type { SceneDefinition } from '@/app/dev/scenes/steps'
import { call, until, wait, screenIs } from '@/app/dev/scenes/steps'
import { TO_NARI_MANAGEMENT, TO_SEASON_MANAGEMENT } from '@/app/dev/scenes/routes'

export const OUTING_SCENES: Readonly<Record<string, SceneDefinition>> = {
  'nari-outing': {
    description: '나리 타자편 외출 지도 112 (관리 [외출] — runCommand)',
    fixture: 'nari-y1',
    steps: [...TO_NARI_MANAGEMENT, call('관리 [외출]', (h) => h.career.actions.runCommand('외출')), screenIs('외출'), wait(600)],
  },
  'season-outing': {
    description: '시즌모드 외출 지도 0xd1 (관리 메뉴 칸 3 [외출] — goto)',
    fixture: 'season-y1',
    steps: [
      ...TO_SEASON_MANAGEMENT,
      call('관리 메뉴 [외출] (managementMenuTarget 3)', (h) => h.season.actions.goto(0xd1)),
      until('시즌 외출 지도 0xd1', (h) => h.season.scene === 0xd1),
      wait(600),
    ],
  },
}
