import { useRef } from 'react'
import { createRunnerAnimationClock } from '@/widgets/batting-stage/lib/baseRunners'
import { createSkillPanelScene } from '@/widgets/batting-stage/lib/skillPanel'
import { useSkillCheerRestore } from '@/widgets/batting-stage/model/useSkillCheerRestore'
import type { TeamGameOptions, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { DEFENSE_SCENE_START, type DefenseSceneMemory, useSceneScopedRef } from './otherSlices'

/** 경기 장면(0x104)이 사는 동안 이어지는 칸 — 공 나는 중 확인 · 홈런 글자 · 주자 애니 시계 · 스킬 판 */
export function useSceneScopedParts(options: TeamGameOptions, progress: TeamGameProgress) {
  /** 타석 화면이 채우는 "공이 나는 동안(상태 0x11)인가" — 원본 도루 키 0x53610 은 이때만 받는다 */
  const flightProbeRef = useRef<(() => boolean) | null>(null)
  /** 경기 장면 동안 남는 HOMERUN 글자 칸 · 표시 비거리 +0x36 — 수비 판 홈런 연출이 판마다 이어 쓴다 (`defenseHomeRunEffects`) */
  const defenseSceneRef = useSceneScopedRef<DefenseSceneMemory>(DEFENSE_SCENE_START, options)
  /** 장면 +0xf24 의 루상 주자 애니 0~2 — 장면이 사는 동안 0x35b94 가 부를 때마다 돈다 (`RunnerAnimationClock`) */
  const runnerAnimationClockRef = useSceneScopedRef(createRunnerAnimationClock(), options)
  /** 경기 스킬 표시 판의 함성 비트 칸 skin+0x44c(0x3301c 가 두 측 0x3ff) · 애니 7 · 8 — 경기 장면 수명 (`skillPanel`) */
  const skillPanelSceneRef = useSceneScopedRef(createSkillPanelScene(), options)
  // 교체 연출 0x16 진입 0x3d458 의 대타 가지 0x668cc — 사람 대타 · 사람 수비 타석의 CPU 대타 모두 (`cheerRestore`)
  useSkillCheerRestore(progress.substitutionScene, skillPanelSceneRef)
  return { flightProbeRef, defenseSceneRef, runnerAnimationClockRef, skillPanelSceneRef }
}
