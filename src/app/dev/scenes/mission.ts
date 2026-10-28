// 장면 표 — 미션 — 타자 미션 1 타석 · 투수 미션 3 구질 고르기 · 결과 판. 도메인 이름은 파일 이름(`yarn e2e:only --area <도메인>`).
import type { SceneDefinition } from '@/app/dev/scenes/steps'
import { wait, keyUntil, missionIs } from '@/app/dev/scenes/steps'
import { toMission } from '@/app/dev/scenes/routes'

export const MISSION_SCENES: Readonly<Record<string, SceneDefinition>> = {
  'mission-bat': {
    description: '타자 미션 1 「명품 타자의 첫 걸음」 첫 타석 0xe (나리 타자편 저장의 선수 — 미션 선수 고르기 · 목록 [61] 예)',
    fixture: 'nari-y1',
    // 픽스처는 부팅 씨앗이 없어 시계로 굴린다 — 브라우저 · 기기마다 같은 공 · 같은 판에 닿게 정한다
    seed: 1,
    steps: [
      ...toMission('타자', 1),
      keyUntil('Enter', '미션 타석 0xe', missionIs((peek) => peek.side === '타자' && peek.isAwaitingConfirm), 400, 30000),
      wait(400),
    ],
  },
  'mission-pitch': {
    description: '투수 미션 3 「혼이 실린 스트라이크」 구질 고르기 0xf (나리 투수편 저장의 선수)',
    fixture: 'pitcher-y1',
    // 픽스처는 부팅 씨앗이 없어 시계로 굴린다 — 브라우저 · 기기마다 같은 공 · 같은 판에 닿게 정한다
    seed: 1,
    steps: [
      ...toMission('투수', 3),
      keyUntil('Enter', '미션 구질 고르기 0xf', missionIs((peek) => peek.side === '투수' && peek.isPitchSlotPickerShown), 400, 30000),
      wait(400),
    ],
  },
  'mission-result': {
    description: '투수 미션 3 결과 판 0x19 — 10구 제한까지 구질 · 코스 · 게이지 OK 만 되풀이',
    fixture: 'pitcher-y1',
    // 픽스처는 부팅 씨앗이 없어 시계로 굴린다 — 브라우저 · 기기마다 같은 공 · 같은 판에 닿게 정한다
    seed: 1,
    snapshot: 'mission-result',
    steps: [
      ...toMission('투수', 3),
      keyUntil('Enter', '미션 결과 판 0x19', missionIs((peek) => peek.isResultShown), 300, 150000),
      wait(1500),
    ],
  },
}
