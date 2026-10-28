// 장면 표 — 시즌모드 — 관리 0xc9 · 포스트시즌 · 국가대항전 · 엔딩. 도메인 이름은 파일 이름(`yarn e2e:only --area <도메인>`).
import type { SceneDefinition } from '@/app/dev/scenes/steps'
import { MODE, call, until, wait } from '@/app/dev/scenes/steps'
import { TO_SEASON_MANAGEMENT, toSeasonState } from '@/app/dev/scenes/routes'

export const SEASON_SCENES: Readonly<Record<string, SceneDefinition>> = {
  'season-management': {
    description: '시즌모드 관리 메뉴 0xc9',
    fixture: 'season-y1',
    steps: [...TO_SEASON_MANAGEMENT, wait(900)],
  },
  'season-postseason': {
    description: '시즌모드 포스트시즌 시작 0xee — 정규시즌 45경기를 마친 저장(phase 0xb)으로 들어가 시작 이벤트(0xd3)가 선 자리',
    fixture: 'season-postseason',
    steps: [
      call('시즌모드 들어가기 (onSelectMode 시즌모드)', (h) => {
        h.setLastPlayedMode(MODE.시즌)
        h.setScreen({ kind: '시즌모드' })
      }),
      // 진입 분기 0xcb 가 0xee 로 보내고, 0xee 는 곧바로 이벤트 재생 0xd3 을 연다
      until('포스트시즌 시작 0xee → 이벤트 0xd3', (h) => h.screen.kind === '시즌모드' && h.season.scene === 0xd3),
      wait(1500),
    ],
  },
  'season-cup': {
    description: '시즌모드 국가대항전 0xf3 — 1년차 정규시즌 45경기 · 결산 뒤 예선 1경기 앞 (진입 분기 0xcb 의 국가대항전 칸 갈래)',
    fixture: 'season-cup',
    steps: [...toSeasonState(0xf3, '국가대항전 0xf3'), wait(900)],
  },
  'season-ending': {
    description: '시즌모드 10년차 엔딩 0xf5 — 저장 phase 6(엔딩)이라 진입 분기 0xcb 가 곧장 엔딩으로 (soak 픽스처)',
    fixture: 'season-ending',
    seed: 1,
    steps: [...toSeasonState(0xf5, '시즌 엔딩 0xf5'), wait(1500)],
  },
}
