// 도메인 general — 일반모드 경기: 빠른실행 · 타석 · 구질 고르기 · 수비 · 자동진행 중계 (장면 표 `src/app/dev/scenes/general.ts`).
export const sources = [
  'src/pages/general-mode/',
  'src/pages/team-game/',
  'src/features/play-team-game/',
  'src/features/play-game/',
  'src/pages/match-settings/',
  'src/pages/auto-play-relay/',
  'src/entities/game/',
  'src/entities/team/',
  'src/entities/league/',
  'src/widgets/game-scene/',
  'src/widgets/line-score/',
  'src/widgets/scoreboard-frame/',
  'src/widgets/matchup-cards/',
  'src/widgets/field-walk/',
  'src/features/defense-play/',
  'src/pages/defense/',
  'src/entities/fielding/',
  'src/entities/defense-controls/',
  'src/pages/pitching/',
  'src/entities/pitching/',
  'src/widgets/entry-editor/',
  'src/app/model/useAtBatRunner',
]
export const representative = 'general-bat'

export const actions = {
  'general-bat': [
    { name: "경기 중 메뉴 '*'", steps: ['@메뉴'], expect: '계속하기', undo: ['@닫기'] },
    { name: '메뉴 → 자동진행 질문 상자', steps: ['@메뉴', 'w300', 'ArrowDown', 'Enter'], expect: '예', undo: ['Escape', 'w300', 'Escape'] },
    { name: "대타 창 '#'", steps: ['@# 대타'], expect: '# 취소', undo: ['@# 취소'] },
  ],
  'general-pitch': [
    { name: "경기 중 메뉴 '*'", steps: ['@메뉴'], expect: '계속하기', undo: ['@닫기'] },
    { name: "투수 교체 창 '#'", steps: ['@# 교체'], expect: '# 취소', undo: ['@# 취소'] },
  ],
  'general-relay': [
    // CLR 중단 질문 StrGAME[6] — [아니오]면 중계가 그대로 이어진다
    { name: '자동진행 중단 질문 상자', steps: ['@CLR 중단'], expect: '예', undo: ['@아니오'] },
  ],
}
