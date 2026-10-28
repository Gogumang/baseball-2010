// 장면 표 — 메뉴 · 새로 시작 — 타이틀 · 메인 메뉴 · 나리 타자편 · 투수편 · 시즌모드 새로. 도메인 이름은 파일 이름(`yarn e2e:only --area <도메인>`).
import type { SceneDefinition } from '@/app/dev/scenes/steps'
import { MODE, call, key, wait, screenIs } from '@/app/dev/scenes/steps'
import { TO_TITLE } from '@/app/dev/scenes/routes'

export const MENU_SCENES: Readonly<Record<string, SceneDefinition>> = {
  title: {
    description: '타이틀 (켤 때 길: 이용안내 → 로고 → 타이틀)',
    fixture: 'none',
    steps: TO_TITLE,
  },
  'main-menu': {
    description: '메인 메뉴 처음 단 (타이틀에서 키)',
    fixture: 'none',
    steps: [...TO_TITLE, key('Enter'), screenIs('메인메뉴'), wait(600)],
  },
  'nari-new': {
    description: '나리 타자편 새로 — 팀 고르기 (저장 없음, onNewGame 타자편)',
    fixture: 'empty',
    steps: [
      call('타자편 새로 (onNewGame 타자편)', (h) => {
        h.setLastPlayedMode(MODE.타자편)
        if (h.career.savedCareer !== null) throw new Error('타자편 저장이 있다 — fixture=none 으로 저장을 비워라')
        h.setScreen({ kind: '팀선택' })
      }),
      screenIs('팀선택'),
    ],
  },
  'pitcher-new': {
    description: '나리 투수편 새로 — 등록 (저장 없음, onNewGame 투수편)',
    fixture: 'empty',
    steps: [
      call('투수편 들어가기 (onNewGame 투수편)', (h) => {
        h.setLastPlayedMode(MODE.투수편)
        h.setScreen({ kind: '투수편' })
      }),
      screenIs('투수편'),
    ],
  },
  'season-new': {
    description: '시즌모드 처음 — 팀 고르기 (저장 없음)',
    fixture: 'empty',
    steps: [
      call('시즌모드 들어가기 (onSelectMode 시즌모드)', (h) => {
        h.setLastPlayedMode(MODE.시즌)
        h.setScreen({ kind: '시즌모드' })
      }),
      screenIs('시즌모드'),
    ],
  },
}
