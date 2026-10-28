// 장면 표 — 나리 투수편 — 관리 · 첫 경기 구질 고르기 · 내 수비 판. 도메인 이름은 파일 이름(`yarn e2e:only --area <도메인>`).
import type { SceneDefinition } from '@/app/dev/scenes/steps'
import { wait, keyUntil, pitcherGameIs } from '@/app/dev/scenes/steps'
import { TO_PITCHER_MANAGEMENT, TO_PITCHER_PITCH } from '@/app/dev/scenes/routes'

export const PITCHER_SCENES: Readonly<Record<string, SceneDefinition>> = {
  'pitcher-management': {
    description: '나리 투수편 관리 화면',
    fixture: 'pitcher-y1',
    steps: [...TO_PITCHER_MANAGEMENT, wait(900)],
  },
  'pitcher-pitch': {
    description: '나리 투수편 경기 — 1년차 첫 경기 첫 수비 타석의 구질 고르기 0xf (관리 [다음경기] → 경기시작)',
    fixture: 'pitcher-y1',
    // 픽스처는 부팅 씨앗이 없어 시계로 굴린다 — 브라우저 · 기기마다 같은 공 · 같은 판에 닿게 정한다
    seed: 1,
    steps: [...TO_PITCHER_PITCH, wait(400)],
  },
  'pitcher-defense': {
    description: '나리 투수편 경기 — 던진 공이 맞아 뜬 내 수비 판 0x17 (구질 · 코스 · 게이지 OK 만 되풀이)',
    fixture: 'pitcher-y1',
    // 픽스처는 부팅 씨앗이 없어 시계로 굴린다 — 브라우저 · 기기마다 같은 공 · 같은 판에 닿게 정한다
    seed: 1,
    steps: [
      ...TO_PITCHER_PITCH,
      keyUntil(
        'Enter',
        '투수편 수비 판 0x17',
        pitcherGameIs((peek) => peek.isDefensePlayShown),
        500,
        90000,
      ),
      wait(300),
    ],
  },
}
