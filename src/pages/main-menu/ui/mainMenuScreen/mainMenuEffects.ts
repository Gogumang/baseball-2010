import type { MainMenuEffect } from '@/pages/main-menu/model/mainMenu'
import type { GameMode, MainMenuScreenProps } from '@/pages/main-menu/ui/mainMenuScreen/mainMenuScreenProps'

/** 곧장 모드 화면으로 가는 결과 — 결과 이름이 곧 `onSelectMode` 의 모드다 */
const SELECT_MODE_EFFECTS: ReadonlySet<string> = new Set<GameMode>([
  '미션',
  '홈런더비',
  '시즌모드',
  '일반모드',
  '일반모드빠른실행',
  // 일반모드 중간 저장 이어하기 — 상태 0x27 → 0x327b8(this, 1) → 0x213c0(앱, 1, 0) → 장면 0x104
  '일반모드경기이어하기',
])

/** 처음 메뉴에서 갈라지는 화면 — 스페셜 6 · 도움말 7 · 환경설정 8 · 게임문의 10 (표 0xcebdc) */
function routeTopEffect(effect: Exclude<MainMenuEffect, null>, props: MainMenuScreenProps) {
  if (effect === '스페셜') props.onSpecial()
  else if (effect === '도움말') props.onHelp()
  else if (effect === '환경설정') props.onSettings()
  else if (effect === '게임문의') props.onInquiry?.()
}

/** 메뉴 결과를 부르는 쪽 콜백으로 — 나리 편(새로 · 곧장 경기) · 모드 · 처음 메뉴 화면 */
export function routeMainMenuEffect(effect: Exclude<MainMenuEffect, null>, props: MainMenuScreenProps) {
  if (effect === '나리타자편') props.onNewGame('타자편')
  else if (effect === '나리투수편') props.onNewGame('투수편')
  else if (effect === '나리타자편경기') (props.onResumeNariGame ?? props.onNewGame)('타자편')
  else if (effect === '나리투수편경기') (props.onResumeNariGame ?? props.onNewGame)('투수편')
  else if (SELECT_MODE_EFFECTS.has(effect)) props.onSelectMode(effect as GameMode)
  else routeTopEffect(effect, props)
}
