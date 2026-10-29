import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { SubstitutionScene } from '@/features/play-game/model/substitutionScene'
import { restoreCheerBit } from '@/widgets/batting-stage/lib/skillPanel'
import type { SkillPanelScene } from '@/widgets/batting-stage/lib/skillPanel'

/**
 * 교체 연출 0x16 이 설 때 대타 가지의 0x668cc(스킨, 공격 팀, 0)를 경기 장면 칸에 한 번 먹인다 (`SubstitutionScene.cheerRestore`).
 * 같은 연출(`serial`)을 두 번 먹이지 않는다.
 */
export function useSkillCheerRestore(
  scene: SubstitutionScene | null | undefined,
  skillPanelSceneRef: MutableRefObject<SkillPanelScene> | undefined,
): void {
  const appliedRef = useRef<SubstitutionScene | null>(null)
  useEffect(() => {
    if (scene === null || scene === undefined || scene === appliedRef.current) return
    appliedRef.current = scene
    const restore = scene.cheerRestore
    if (restore === undefined || skillPanelSceneRef === undefined) return
    skillPanelSceneRef.current.cheerBits = restoreCheerBit(skillPanelSceneRef.current.cheerBits, restore.attackSide, restore.recordSlot)
  }, [scene, skillPanelSceneRef])
}
