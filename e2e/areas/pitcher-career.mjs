// 도메인 pitcher-career — 나리 투수편 포스트시즌 · 국가대항전 · 엔딩 · 명예의 전당 (장면 표 `src/app/dev/scenes/pitcherCareer.ts`, soak 픽스처).
export const sources = [
  'src/pages/ending/',
  'src/pages/national-cup/',
  'src/entities/national-cup/',
  'src/entities/awards/',
  'src/entities/pitcher-career/',
  'src/app/model/usePitcherLeagueSession',
  'src/pages/pitcher-league/',
  'e2e/fixtures/pitcher-',
]
export const representative = 'pitcher-postseason'

export const actions = {
  'pitcher-postseason': [{ name: '진입 팝업 닫기 → 대진판', steps: ['@OK', 'w600'], expect: '다음' }],
  'pitcher-cup': [{ name: '히든 팀 팝업 닫기 → 대진판', steps: ['@확인', 'w700'], expect: '국가대항전 대진' }],
  'pitcher-cup-result': [
    // 대회가 끝난 대진판 확인(0x19fdc) → 결과 팝업 0x25 (탈락이면 보상 없이 [확인] 이 대회를 끝낸다)
    { name: '대진판 확인 → 결과 팝업', steps: ['Enter', 'w700'], expect: '알림' },
  ],
  'pitcher-ending': [{ name: '엔딩 키 → 제작진 → 보너스 팝업', steps: ['Enter', 'w2500', 'Enter', 'w800'], expect: 'OK' }],
  'pitcher-hall-of-fame': [{ name: '등록 질문 예 → 등록 목록', steps: ['@예', 'w800'], expect: '1번 슬롯' }],
  'pitcher-postseason-game': [
    { name: "경기 중 메뉴 '*'", steps: ['@메뉴'], expect: '계속하기', undo: ['@닫기'] },
    { name: "강판 물음 '#'", steps: ['@# 강판'], expect: '예', undo: ['@아니오'] },
  ],
  'pitcher-postseason-next': [{ name: '대진판 다음 → 다음 라운드 142 경기 준비', steps: ['@다음', 'w1500'], expect: '경기 시작' }],
  'pitcher-postseason-champion': [{ name: '우승 팀 발표 OK → 한국시리즈 우승 팝업', steps: ['@OK', 'w700'], expect: '알림' }],
}
