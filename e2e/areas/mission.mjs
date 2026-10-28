// 도메인 mission — 타자 미션 1 타석 · 투수 미션 3 구질 고르기 · 결과 판 (장면 표 `src/app/dev/scenes/mission.ts`).
export const sources = [
  'src/pages/mission-play/',
  'src/pages/mission-select/',
  'src/entities/mission/',
  'src/app/ui/MissionRoutes',
  'src/app/model/useMissionSession',
  'src/app/model/missionVibration',
  'src/app/model/aceMatchScanGuard',
]
export const representative = 'mission-bat'

export const actions = {
  'mission-bat': [{ name: "경기 중 메뉴 '*'", steps: ['@메뉴'], expect: '계속하기', undo: ['@닫기'] }],
  'mission-pitch': [{ name: "경기 중 메뉴 '*'", steps: ['@메뉴'], expect: '계속하기', undo: ['@닫기'] }],
}
