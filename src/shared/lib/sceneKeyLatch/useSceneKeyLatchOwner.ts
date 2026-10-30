import { useEffect, useState } from 'react'
import { createSceneKeyLatch, type SceneKeyLatch } from '@/shared/lib/sceneKeyLatch/latchCore'
import { openSceneKeyLatch } from '@/shared/lib/sceneKeyLatch/slotKeys'

/** 부품이 서 있는 동안 올려 두는 제 키 칸 — 키 손잡이는 여기에 넣고(`push`) 부품의 틀이 꺼낸다(`runSceneKeys` · `useSceneTick`) */
export function useSceneKeyLatchOwner(): SceneKeyLatch {
  const [latch] = useState(() => createSceneKeyLatch())
  useEffect(() => openSceneKeyLatch(latch), [latch])
  return latch
}
