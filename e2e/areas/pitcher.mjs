// 도메인 pitcher — 나리 투수편 관리 · 첫 경기 구질 고르기 · 내 수비 판 (장면 표 `src/app/dev/scenes/pitcher.ts`).
export const sources = [
  'src/pages/pitcher-league/',
  'src/app/ui/PitcherLeagueRoute',
  'src/app/model/usePitcherLeagueSession',
  'src/app/model/modePitcher',
  'src/entities/pitcher-career/',
  'src/features/play-pitcher-game/',
  'src/pages/pitching/',
  'src/entities/pitching/',
  'src/features/defense-play/',
  'src/pages/defense/',
  'src/entities/fielding/',
  'src/entities/defense-controls/',
]
export const representative = 'pitcher-management'

export const actions = {
  'pitcher-management': [
    { name: '휴식 알림 상자', steps: ['@휴식'], expect: '알림', undo: ['Escape'] },
    // r203 — 구질훈련 창 칸이 예 · 아니오를 덮었다
    { name: '트레이닝 → 변화 질문 상자', steps: ['@트레이닝', 'w600', '@변화'], expect: '예', undo: ['Escape', 'w200', 'Escape', 'w600'] },
    // r207 — 칭호 창
    {
      name: '선수정보 → 칭호 창',
      steps: ['@선수정보', 'w600', 'Enter', 'w300', '@* 칭호'],
      expect: '칭호',
      undo: ['Escape', 'w200', 'Escape', 'w200', 'Escape', 'w600'],
    },
    { name: '다음경기 기록실 창', steps: ['@다음경기'], expect: '기록실', undo: ['Escape'] },
  ],
  'pitcher-pitch': [
    { name: "경기 중 메뉴 '*'", steps: ['@메뉴'], expect: '계속하기', undo: ['@닫기'] },
    // 모드 3 의 '#' 는 교체 창이 아니라 강판 물음 StrGAME[104]
    { name: "강판 물음 '#'", steps: ['@# 강판'], expect: '예', undo: ['@아니오'] },
  ],
}
