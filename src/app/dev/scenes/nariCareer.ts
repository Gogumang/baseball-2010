// 장면 표 — 나리 타자편 커리어 끝자락 — 포스트시즌 · 국가대항전 · 엔딩 · 명예의 전당 (soak 픽스처). 도메인 이름은 파일 이름(`yarn e2e:only --area <도메인>`).
import type { SceneDefinition } from '@/app/dev/scenes/steps'
import { wait, keyUntil, offersHave, messageBoxHas } from '@/app/dev/scenes/steps'
import { toNariResume } from '@/app/dev/scenes/routes'
import { CLOSE_CUP_ENTRY_POPUPS, POSTSEASON_GAME_START, POSTSEASON_CHAMPION, CUP_RESULT_POPUP, EVENT_TO_ENDING } from '@/app/dev/scenes/careerRoutes'

export const NARI_CAREER_SCENES: Readonly<Record<string, SceneDefinition>> = {
  'nari-postseason': {
    description: '나리 타자편 포스트시즌 128 시작 — 1년차 45경기 뒤 준플레이오프 대진 (이어하기가 128 진입 0x120a4 를 다시 밟는다, soak 픽스처)',
    fixture: 'nari-postseason',
    seed: 1,
    steps: [...toNariResume('포스트시즌'), wait(900)],
  },
  'nari-cup': {
    description:
      '나리 타자편 국가대항전 134 진입 대진판 — 134 가 처음 선 순간(463 끝) 저장의 이어하기가 134 로 돌아와 히든 팀 · 칭호 8 팝업 (soak 픽스처)',
    fixture: 'nari-cup',
    seed: 1,
    steps: [...toNariResume('국가대항전'), wait(900)],
  },
  'nari-cup-result': {
    description: '나리 타자편 국가대항전 134 — 대회가 끝난 대진판, 진입 팝업(히든 팀)을 닫은 자리 (OK 가 결과 팝업 0x25, soak 픽스처)',
    fixture: 'nari-cup-result',
    seed: 1,
    steps: [...toNariResume('국가대항전'), wait(600), CLOSE_CUP_ENTRY_POPUPS, wait(600)],
  },
  'nari-ending': {
    description: '나리 타자편 13년차 은퇴 엔딩 141 — 엔딩 직전 저장의 이어하기가 연말 · 은퇴 이벤트 114 로 가고 OK 로 넘겨 141 (soak 픽스처)',
    fixture: 'nari-ending',
    seed: 1,
    snapshot: 'nari-ending',
    steps: [...toNariResume('이벤트'), ...EVENT_TO_ENDING((h) => h.screen.kind === '엔딩')],
  },
  'nari-hall-of-fame': {
    description: '나리 타자편 명예의 전당 등록 질문 0x2d — 보너스 뒤 저장의 이어하기가 141 로 곧장, 키로 제작진 → 등록 질문 (soak 픽스처)',
    fixture: 'nari-hall-of-fame',
    seed: 1,
    steps: [...toNariResume('엔딩'), keyUntil('Enter', '명예의 전당 등록 질문', messageBoxHas('예'), 600, 30000), wait(600)],
  },
  // r254 — 사람 팀이 포스트시즌 시리즈를 직접 치르는 길 · 한국시리즈 우승 팝업 · 국가대항전 한국 우승 (soak 픽스처)
  'nari-postseason-game': {
    description: '나리 타자편 포스트시즌 내 시리즈 경기 시작 — 1년차 한국시리즈 내 차례 대진 [다음] → 142 경기 준비 → 경기 첫 내 타석 (soak 픽스처)',
    fixture: 'nari-postseason-game',
    seed: 1,
    steps: [
      ...toNariResume('포스트시즌'),
      // 타자편 경기 화면(`GameRoute`)은 들여다보기 칸이 없다 — 내 타석(터치 상황 버튼 번트 '8')이 서면 멈춘다(돌발미션 장면과 같은 표지)
      ...POSTSEASON_GAME_START(
        (h) => h.screen.kind === '경기준비',
        (h) => h.screen.kind === '경기' && offersHave('번트')(),
      ),
    ],
  },
  'nari-postseason-next': {
    description:
      '나리 타자편 포스트시즌 내 시리즈가 끝나고 다음 라운드 — 7년차 준플레이오프를 이기고 116 → 114 → 128 로 돌아온 플레이오프 대진 (soak 픽스처)',
    fixture: 'nari-postseason-next',
    seed: 1,
    steps: [...toNariResume('포스트시즌'), wait(900)],
  },
  'nari-postseason-champion': {
    description: '나리 타자편 포스트시즌 끝 — 내 팀이 한국시리즈를 이긴 대진 [다음] → StrMODE[137] 우승 팀 발표 팝업 7 (soak 픽스처)',
    fixture: 'nari-postseason-champion',
    seed: 1,
    steps: [...toNariResume('포스트시즌'), ...POSTSEASON_CHAMPION(false)],
  },
  'nari-korean-series': {
    description: '나리 타자편 한국시리즈 우승 — 우승 팀 발표 팝업 7 을 OK 로 닫아 StrMODE[190] 내 팀 우승 팝업 8 (soak 픽스처)',
    fixture: 'nari-postseason-champion',
    seed: 1,
    steps: [...toNariResume('포스트시즌'), ...POSTSEASON_CHAMPION(true)],
  },
  'nari-cup-win': {
    description: '나리 타자편 국가대항전 한국 우승 — 대회가 끝난 대진판 확인 → 결과 팝업 0x25 (soak 픽스처, 씨앗 5 판)',
    fixture: 'nari-cup-win',
    seed: 1,
    steps: [...toNariResume('국가대항전'), ...CUP_RESULT_POPUP],
  },
  'nari-cup-cover': {
    description: '나리 타자편 국가대항전 끝 → 새 시즌 — 결과 · 보상 팝업을 닫으면 134 대진판이 선 채 아홉 틀 어두워지고 137 "N년차" 표지 (r287)',
    fixture: 'nari-cup-win',
    seed: 1,
    steps: [...toNariResume('국가대항전'), ...CUP_RESULT_POPUP, keyUntil('Enter', '137 표지', (h) => h.screen.kind === '연차표지', 700, 15000)],
  },
}
