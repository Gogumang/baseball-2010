// 장면 표 — 일반모드 경기 — 빠른실행 · 타석 · 구질 고르기 · 수비 · 자동진행 중계. 도메인 이름은 파일 이름(`yarn e2e:only --area <도메인>`).
import type { SceneDefinition } from '@/app/dev/scenes/steps'
import { until, key, wait, keyUntil, teamGameIs } from '@/app/dev/scenes/steps'
import { TO_GENERAL_QUICK, TO_GENERAL_GAME } from '@/app/dev/scenes/routes'

export const GENERAL_SCENES: Readonly<Record<string, SceneDefinition>> = {
  'general-quick': {
    description: '일반모드 빠른실행 — 경기정보(상태 22)에 경기설정 창이 저절로 뜬 자리 (진입 창 [13] 빠른실행 답)',
    fixture: 'general-bat',
    steps: TO_GENERAL_QUICK,
  },
  'general-bat': {
    description: '일반모드 타석 — 경기 시작 직후 1회초 사람 팀 첫 타자 (씨앗 1: 사람 선공 · 이닝플레이 자동진행 없음)',
    fixture: 'general-bat',
    steps: [
      ...TO_GENERAL_GAME,
      until(
        '사람 타석 0xe · 0xf',
        teamGameIs((peek) => peek.canBat && peek.acceptsChangeKey),
        15000,
      ),
      wait(300),
    ],
  },
  'general-pitch': {
    description: '일반모드 투구 — 경기 시작 직후 1회초 사람 투수 구질 고르기 (씨앗 2: CPU 선공)',
    fixture: 'general-pitch',
    steps: [
      ...TO_GENERAL_GAME,
      until(
        '사람 수비 타석 0xe · 0xf',
        teamGameIs((peek) => peek.canPitch && peek.acceptsChangeKey),
        15000,
      ),
      // 타자 소개 판을 OK 로 넘겨 구질 고르기 판(`PitchSlotPicker`)이 설 때까지
      keyUntil(
        'Enter',
        '구질 고르기 0xf',
        teamGameIs((peek) => peek.isPitchSlotPickerShown),
        700,
        15000,
      ),
      wait(400),
    ],
  },
  'general-defense': {
    description: '일반모드 수비 — 사람 투수가 던져 타구가 뜬 인플레이 (씨앗 2 · OK 만 되풀이)',
    fixture: 'general-pitch',
    steps: [
      ...TO_GENERAL_GAME,
      until(
        '사람 수비 타석 0xe · 0xf',
        teamGameIs((peek) => peek.canPitch && peek.acceptsChangeKey),
        15000,
      ),
      // 구질 · 코스 · 게이지 모두 OK — 공을 칠 때까지 던진다
      keyUntil(
        'Enter',
        '수비 판 0x17',
        teamGameIs((peek) => peek.defensePlaySide === '수비'),
        500,
        60000,
      ),
      wait(300),
    ],
  },
  'general-relay': {
    description: "일반모드 자동진행 중계 0x21 — 첫 타석에서 경기 중 메뉴 '*' [자동진행] 예 (general-bat 픽스처 씨앗 1)",
    fixture: 'general-bat',
    snapshot: 'general-relay',
    steps: [
      ...TO_GENERAL_GAME,
      until(
        '사람 타석 0xe · 0xf',
        teamGameIs((peek) => peek.canBat && peek.acceptsChangeKey),
        15000,
      ),
      key('*'),
      wait(500),
      key('ArrowDown'),
      key('Enter'),
      wait(400),
      // 자동진행 질문 상자 — 처음 커서 [예]
      keyUntil(
        'Enter',
        '자동진행 중계 0x21',
        teamGameIs((peek) => peek.isAutoRelay),
        400,
        8000,
      ),
      wait(800),
    ],
  },
}
