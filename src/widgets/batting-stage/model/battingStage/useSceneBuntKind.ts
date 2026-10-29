import { useCallback, useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { sceneBuntKindOnPitch } from '@/widgets/batting-stage/lib/buntStance'
import type { StageRefs } from '@/widgets/batting-stage/model/stageRefs'

export interface SceneBuntKind {
  /** 장면 +0xfdc — 사람 키가 쓰고(`sceneBuntKind` 주석) 판정된 공이 그 값을 넘긴다. 부르는 쪽이 들고 있으면 그 값을 따른다 */
  readonly kindRef: MutableRefObject<number>
  /** 이 공의 +0xfdc — 새 공이면 0x11 진입 0x3de10(3deb8 0x340dc)의 memset 처럼 0 으로 지운 뒤 읽는다(`sceneBuntKindOnPitch`) */
  readonly kindOfThisPitch: () => number
}

/** 장면 번트 종류 칸 +0xfdc — 부르는 쪽이 넘긴 값(`sceneBuntKind`)을 따르고, 공이 바뀌면 지운다 */
export function useSceneBuntKind(pitchRef: StageRefs['pitchRef'], sceneBuntKind: number | undefined): SceneBuntKind {
  const kindRef = useRef(sceneBuntKind ?? 0)
  useEffect(() => {
    if (sceneBuntKind !== undefined) kindRef.current = sceneBuntKind
  }, [sceneBuntKind])
  /** +0xfdc 를 마지막으로 지운 공 */
  const sceneBuntPitchRef = useRef<Pitch | null>(null)
  const kindOfThisPitch = useCallback(() => {
    const memory = sceneBuntKindOnPitch({ pitch: sceneBuntPitchRef.current, kind: kindRef.current }, pitchRef.current)
    sceneBuntPitchRef.current = memory.pitch
    kindRef.current = memory.kind
    return memory.kind
  }, [pitchRef])
  return { kindRef, kindOfThisPitch }
}
