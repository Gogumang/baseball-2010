// 도메인 season — 시즌모드 관리 0xc9 · 포스트시즌 · 국가대항전 · 엔딩 (장면 표 `src/app/dev/scenes/season.ts`).
export const sources = [
  'src/pages/season/', 'src/pages/season-end/', 'src/widgets/season/', 'src/widgets/standings/', 'src/entities/season-mode/',
  'src/app/ui/SeasonRoute', 'src/app/model/useSeasonSession', 'src/app/model/seasonEvents', 'src/app/model/seasonHallOfFameRecords',
  'src/app/model/seasonRecordAces', 'src/app/model/seasonEvaluationJingle',
]
export const representative = 'season-management'

export const actions = {
  'season-management': [
    { name: '다음경기 순위표', steps: ['@다음경기'], expect: '되돌아가기 칸', undo: ['Escape'] },
  ],
  'season-ending': [
    // 엔딩 0xf5 의 키 0x6b3c — 저장의 보너스 칸(SR+0x7b)이 서 있어 팝업 없이 관리 메뉴 0xc9 로 (시즌모드는 등록 질문이 없다)
    { name: '엔딩 키 → 관리 메뉴', steps: ['Enter', 'w1500'], expect: '다음경기' },
  ],
}

export const allowed = [
  {
    match: (scene, row) => scene === 'season-management' && row.label === 'button "되돌아가기"' && row.by === 'button "되돌아가기 칸"',
    why: '시즌 다음경기 0xd8 — 바닥띠 되돌아가기 그림 단추를 같은 자리 같은 일(onCancel)의 누름 칸이 덮는다. 판 전체 확인 칸(7) 위로 올리려고 둔 것(r186)',
  },
]
