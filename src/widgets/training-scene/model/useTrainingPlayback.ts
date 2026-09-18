import { useRef, useState } from 'react'

/**
 * 훈련 연출 → 결과 순서를 지킨다.
 * 연출이 도는 동안에는 능력치를 올리지 않고, 연출이 끝나야 onRunTraining 을 부른다.
 */
export function useTrainingPlayback(onRunTraining: (menuId: string) => void) {
  const [playingMenuId, setPlayingMenuId] = useState<string | null>(null)

  const playingRef = useRef<string | null>(null)
  const onRunRef = useRef(onRunTraining)
  onRunRef.current = onRunTraining

  const start = (menuId: string) => {
    if (playingRef.current !== null) return
    playingRef.current = menuId
    setPlayingMenuId(menuId)
  }

  // 애니메이션 루프에서 불린다. 같은 연출이 두 번 끝났다고 알려도 훈련은 한 번만 반영한다.
  const finish = () => {
    const menuId = playingRef.current
    if (menuId === null) return
    playingRef.current = null
    setPlayingMenuId(null)
    onRunRef.current(menuId)
  }

  return { playingMenuId, start, finish }
}
