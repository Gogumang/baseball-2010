// 도메인 nari-career — 나리 타자편 포스트시즌 · 국가대항전 · 엔딩 · 명예의 전당 (장면 표 `src/app/dev/scenes/nariCareer.ts`, soak 픽스처).
export const sources = [
  'src/pages/ending/',
  'src/pages/national-cup/',
  'src/entities/national-cup/',
  'src/entities/awards/',
  'src/app/model/careerPostseason',
  'src/app/model/useCareerSession',
  'src/entities/career/',
  'src/pages/management/lib/nariYearCover',
  'e2e/fixtures/nari-',
]
export const representative = 'nari-postseason'

export const actions = {
  // r236 — soak 픽스처 장면
  'nari-postseason': [
    // 128 진입 팝업(0xbbef9)을 닫으면 대진판 [다음] 이 선다
    { name: '진입 팝업 닫기 → 대진판', steps: ['@OK', 'w600'], expect: '다음' },
  ],
  'nari-cup': [
    // 134 진입 팝업 — 히든 팀 열림(StrCOMMON[138]) 다음에 칭호 8 "국가 대표" 창
    { name: '히든 팀 팝업 닫기 → 칭호 창', steps: ['@확인', 'w700'], expect: '칭호' },
  ],
  'nari-cup-result': [
    // 대회가 끝난 대진판 확인(0x19fdc) → 결과 팝업 0x25
    { name: '대진판 확인 → 결과 팝업', steps: ['Enter', 'w700'], expect: '알림' },
  ],
  'nari-ending': [
    // 키 0x1220c — 단계 1 의 키가 제작진으로, 제작진의 키가 보너스 팝업 0x2b
    { name: '엔딩 키 → 제작진 → 보너스 팝업', steps: ['Enter', 'w2500', 'Enter', 'w800'], expect: 'OK' },
  ],
  'nari-hall-of-fame': [
    // 등록 질문 0x2d [예] → 상태 145 명예의 전당 등록 목록
    { name: '등록 질문 예 → 등록 목록', steps: ['@예', 'w800'], expect: '1번 슬롯' },
  ],
  // r254 — 사람 팀 포스트시즌 시리즈 · 한국시리즈 우승 팝업
  'nari-postseason-game': [{ name: "경기 중 메뉴 '*'", steps: ['@메뉴'], expect: '계속하기', undo: ['@닫기'] }],
  'nari-postseason-next': [
    // 키 0x13da0 — 다음 라운드 대진에 내 팀이 있어 142 경기 준비
    { name: '대진판 다음 → 다음 라운드 142 경기 준비', steps: ['@다음', 'w1500'], expect: '경기 시작' },
  ],
  'nari-postseason-champion': [
    // 팝업 7 StrMODE[137] 닫힘 — 우승 팀이 내 팀이라 팝업 8 StrMODE[190] (0x15984)
    { name: '우승 팀 발표 OK → 한국시리즈 우승 팝업', steps: ['@OK', 'w700'], expect: '알림' },
  ],
}
