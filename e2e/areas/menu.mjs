// 도메인 menu — 타이틀 · 메인 메뉴 · 새로 시작 (장면 표 `src/app/dev/scenes/menu.ts`).
// `sources` 는 바뀐 파일 → 이 도메인(`--changed`) · 단위 시험 묶음(`yarn test:area menu`)을 고르는 경로 머리.
export const sources = [
  'src/pages/title/',
  'src/pages/main-menu/',
  'src/widgets/title-window/',
  'src/pages/create-player/',
  'src/pages/help/',
  'src/pages/settings/',
  'src/entities/settings/',
  'src/app/ui/EntryRoutes',
  'src/app/ui/BootShell',
]
export const representative = 'main-menu'

/**
 * 연 상태 — `steps`: 키 이름 · `@이름`(aria-label 이 그 이름인 요소 가운데를 탭/클릭) · `w밀리초`. `expect`: 연 뒤 서 있어야 할 것.
 * `undo`: 기본 상태로 되돌리는 걸음 (`e2e/lib/hits-scene.mjs`)
 */
export const actions = {
  'main-menu': [{ name: '게임시작 목록', steps: ['Enter'], expect: '나만의리그', undo: ['Escape'] }],
}
