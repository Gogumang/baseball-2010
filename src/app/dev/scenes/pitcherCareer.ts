// 장면 표 — 나리 투수편 커리어 끝자락 — 포스트시즌 · 국가대항전 · 엔딩 · 명예의 전당 (soak 픽스처). 도메인 이름은 파일 이름(`yarn e2e:only --area <도메인>`).
import type { SceneDefinition } from '@/app/dev/scenes/steps'
import { wait, keyUntil, pitcherGameIs, messageBoxHas } from '@/app/dev/scenes/steps'
import { toPitcherResume } from '@/app/dev/scenes/routes'
import { CLOSE_CUP_ENTRY_POPUPS, POSTSEASON_GAME_START, POSTSEASON_CHAMPION, CUP_RESULT_POPUP, EVENT_TO_ENDING } from '@/app/dev/scenes/careerRoutes'

export const PITCHER_CAREER_SCENES: Readonly<Record<string, SceneDefinition>> = {
  'pitcher-postseason': {
    description: '나리 투수편 포스트시즌 128 시작 — 1년차 45경기 뒤 준플레이오프 대진 (soak 픽스처)',
    fixture: 'pitcher-postseason',
    seed: 1,
    steps: [...toPitcherResume('포스트시즌'), wait(900)],
  },
  'pitcher-cup': {
    description: '나리 투수편 국가대항전 134 진입 대진판 — 저장의 대회 칸으로 들어서 히든 팀 팝업이 뜬 자리 (soak 픽스처)',
    fixture: 'pitcher-cup',
    seed: 1,
    steps: [...toPitcherResume('국가대항전'), wait(900)],
  },
  'pitcher-cup-result': {
    description: '나리 투수편 국가대항전 134 — 대회가 끝난 대진판, 진입 팝업(히든 팀)을 닫은 자리 (OK 가 결과 팝업 0x25, soak 픽스처)',
    fixture: 'pitcher-cup-result',
    seed: 1,
    steps: [...toPitcherResume('국가대항전'), wait(600), CLOSE_CUP_ENTRY_POPUPS, wait(600)],
  },
  'pitcher-ending': {
    description: '나리 투수편 13년차 은퇴 엔딩 141 — 엔딩 직전 저장으로 들어서 은퇴 이벤트 114 를 OK 로 넘겨 141 (soak 픽스처)',
    fixture: 'pitcher-ending',
    seed: 1,
    steps: [...toPitcherResume('이벤트'), ...EVENT_TO_ENDING((h) => h.screen.kind === '투수편' && h.pitcher.scene === '엔딩')],
  },
  'pitcher-hall-of-fame': {
    description: '나리 투수편 명예의 전당 등록 질문 0x2d — 보너스 뒤 저장으로 141 에 곧장, 키로 제작진 → 등록 질문 (soak 픽스처)',
    fixture: 'pitcher-hall-of-fame',
    seed: 1,
    steps: [
      ...toPitcherResume('엔딩'),
      keyUntil('Enter', '명예의 전당 등록 질문', messageBoxHas('예'), 600, 30000),
      wait(600),
    ],
  },
  'pitcher-postseason-game': {
    description: '나리 투수편 포스트시즌 내 시리즈 경기 시작 — 1년차 한국시리즈 내 차례 대진 [다음] → 142 경기 준비 → 경기 첫 구질 고르기 0xf (soak 픽스처)',
    fixture: 'pitcher-postseason-game',
    seed: 1,
    snapshot: 'pitcher-postseason-game',
    steps: [
      ...toPitcherResume('포스트시즌'),
      ...POSTSEASON_GAME_START(
        (h) => h.screen.kind === '투수편' && h.pitcher.scene === '경기준비',
        (h) => h.screen.kind === '투수편' && h.pitcher.scene === '경기' && pitcherGameIs((peek) => peek.isPitchSlotPickerShown)(),
      ),
    ],
  },
  'pitcher-postseason-next': {
    description: '나리 투수편 포스트시즌 내 시리즈가 끝나고 다음 라운드 — 6년차 준플레이오프를 이기고 돌아온 플레이오프 대진 (soak 픽스처)',
    fixture: 'pitcher-postseason-next',
    seed: 1,
    steps: [...toPitcherResume('포스트시즌'), wait(900)],
  },
  'pitcher-postseason-champion': {
    description: '나리 투수편 포스트시즌 끝 — 내 팀이 한국시리즈를 이긴 대진 [다음] → StrMODE[137] 우승 팀 발표 팝업 7 (soak 픽스처)',
    fixture: 'pitcher-postseason-champion',
    seed: 1,
    steps: [...toPitcherResume('포스트시즌'), ...POSTSEASON_CHAMPION(false)],
  },
  'pitcher-korean-series': {
    description: '나리 투수편 한국시리즈 우승 — 우승 팀 발표 팝업 7 을 OK 로 닫아 StrMODE[190] 내 팀 우승 팝업 8 (soak 픽스처)',
    fixture: 'pitcher-postseason-champion',
    seed: 1,
    steps: [...toPitcherResume('포스트시즌'), ...POSTSEASON_CHAMPION(true)],
  },
  'pitcher-cup-win': {
    description: '나리 투수편 국가대항전 한국 우승 — 3년차 대회가 끝난 대진판 확인 → 결과 팝업 0x25 (soak 픽스처)',
    fixture: 'pitcher-cup-win',
    seed: 1,
    steps: [...toPitcherResume('국가대항전'), ...CUP_RESULT_POPUP],
  },
}
