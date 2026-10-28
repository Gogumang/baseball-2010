// 도메인 nari — 나리 타자편 관리 105 · 경기 뒤 평가 · 첫 타석 · 돌발미션 결과 창 (장면 표 `src/app/dev/scenes/nari.ts`).
export const sources = [
  'src/pages/management/',
  'src/widgets/management/',
  'src/app/ui/CareerRoutes',
  'src/app/ui/GameRoute',
  'src/app/model/useCareerSession',
  'src/app/model/modeBatter',
  'src/entities/career/',
  'src/entities/at-bat/',
  'src/entities/batting/',
  'src/entities/burst-mission/',
  'src/widgets/burst-mission/',
  'src/widgets/batting-stage/',
  'src/features/play-at-bat/',
  'src/pages/game/',
  'src/pages/game-result/',
  'src/pages/record/',
  'src/pages/nari-record-room/',
  'src/widgets/training-scene/',
  'src/widgets/skill-window/',
  'src/widgets/player-detail-window/',
  'src/pages/story/',
  'src/entities/story/',
  'src/widgets/event-portraits/',
  'src/app/model/useStorySchedule',
  'src/app/model/useEventEndFrame',
]
export const representative = 'nari-management'

// 커맨드 줄 칸이 펼쳐지는 여덟 틀(약 0.5초)은 키 · 누름을 버린다(105 [gfx+0x99] · 하위 메뉴 [+0x9a], A-50) — 메뉴를 연 뒤 기다린다
export const actions = {
  'nari-management': [
    { name: '휴식 알림 상자', steps: ['@휴식'], expect: '알림', undo: ['Escape'] },
    { name: '트레이닝 → 히트 질문 상자', steps: ['@트레이닝', 'w600', '@히트'], expect: '예', undo: ['Escape', 'w200', 'Escape', 'w600'] },
    {
      name: '선수정보 → 칭호 창',
      steps: ['@선수정보', 'w600', 'Enter', 'w300', '@* 칭호'],
      expect: '칭호',
      undo: ['Escape', 'w200', 'Escape', 'w200', 'Escape', 'w600'],
    },
    { name: '다음경기 기록실 창', steps: ['@다음경기'], expect: '기록실', undo: ['Escape'] },
  ],
}

/** 기본 상태에서 서 있어야 할 것 — 안 서면 자리가 멈춘 뒤 한 번 더 본다 */
export const expect = {
  'nari-burst-result': '돌발미션',
}
