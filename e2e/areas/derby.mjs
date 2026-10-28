// 도메인 derby — 홈런더비 선수 고르기 · 첫 공 앞 (장면 표 `src/app/dev/scenes/derby.ts`).
export const sources = [
  'src/pages/home-run-derby/',
  'src/entities/home-run-derby/',
  'src/shared/lib/devDerbyStart/',
  'src/widgets/special-swing/',
  'src/widgets/ace-level-up/',
  'src/app/ui/EntryRoutes.derby',
]
export const representative = 'derby-start'

export const actions = {
  'derby-start': [{ name: "경기 중 메뉴 '*'", steps: ['@메뉴'], expect: '계속하기', undo: ['@닫기'] }],
}
