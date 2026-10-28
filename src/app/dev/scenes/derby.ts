// 장면 표 — 홈런더비 — 선수 고르기 · 첫 공 앞 · 단계 N 에서 시작. 도메인 이름은 파일 이름(`yarn e2e:only --area <도메인>`).
import { scenePeeksNow } from '@/shared/lib/scenePeek/scenePeek'
import { setDevDerbyStart } from '@/shared/lib/devDerbyStart/devDerbyStart'
import { ACE_STAGE_THRESHOLDS, DERBY_PITCH_COUNT } from '@/entities/home-run-derby/model/derbyRules'
import type { SceneDefinition } from '@/app/dev/scenes/steps'
import { call, until, key, wait } from '@/app/dev/scenes/steps'
import { TO_DERBY_PICK } from '@/app/dev/scenes/routes'

/**
 * **더비 단계 N 에서 시작** (A-07) — 더비 화면에 들어서기 전에 첫 판을 그 단계의 시작 상태로 적어 둔다(`shared/lib/devDerbyStart`):
 * 단계 N · 누적 = 문턱 표 0xd84dc[N − 1](그 단계로 막 오른 값) · 남은 기회 10(`&derbyPitches=<1~10>` 으로 바꾼다). 첫 0xd 가 그 단계
 * 마투수(0xcfce8[N − 1])를 세우고 0xe 소개 판에서 OK 를 기다린다. 게임 길(실제 단계 오름 0xae3e8 → 0xd)과 같은 판을 실제로 쳐서
 * 닿지 않고 보려고 — 이 장면 밖에서는 칸을 안 쓴다
 */
function derbyStageScenes(stages: readonly number[]): Record<string, SceneDefinition> {
  const entries = stages.map((stage): [string, SceneDefinition] => [
    `derby-stage${stage}`,
    {
      description: `홈런더비 단계 ${stage} 에서 시작 — 누적 ${ACE_STAGE_THRESHOLDS[stage - 1]}M · 마투수 소개 0xe (\`&derbyPitches=\` 남은 기회, 기본 10)`,
      fixture: 'nari-y1',
      steps: [
        call(`더비 단계 ${stage} 시작 상태`, () => {
          const asked = Number(new URLSearchParams(window.location.search).get('derbyPitches') ?? DERBY_PITCH_COUNT)
          const remainingPitches = Number.isInteger(asked) && asked >= 1 && asked <= DERBY_PITCH_COUNT ? asked : DERBY_PITCH_COUNT
          setDevDerbyStart({ stage, totalDistance: ACE_STAGE_THRESHOLDS[stage - 1] ?? 0, remainingPitches })
        }),
        ...TO_DERBY_PICK,
        key('Enter'),
        until(`더비 단계 ${stage} 타석 0xe`, () => scenePeeksNow().homeRunDerby?.acceptsConfirm === true, 15000),
        wait(500),
      ],
    },
  ])
  return Object.fromEntries(entries)
}

export const DERBY_SCENES: Readonly<Record<string, SceneDefinition>> = {
  'derby-pick': {
    description: '홈런더비 선수 고르기 (게임시작 목록 [홈런더비] 답)',
    fixture: 'nari-y1',
    steps: TO_DERBY_PICK,
  },
  'derby-start': {
    description: '홈런더비 시작 — 나리 타자를 골라 첫 공 앞 (1/10)',
    fixture: 'nari-y1',
    steps: [
      ...TO_DERBY_PICK,
      key('Enter'),
      until('더비 타석 0xe (첫 공 앞)', () => scenePeeksNow().homeRunDerby?.acceptsConfirm === true, 15000),
      wait(500),
    ],
  },
  ...derbyStageScenes([2, 3, 4]),
}
