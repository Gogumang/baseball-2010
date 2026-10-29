import { useLayoutEffect, useRef, useState } from 'react'
import type { SeasonSession } from '@/app/model/useSeasonSession'

/**
 * 시즌모드에 들어오는 그 순간 — 장면 0x105 를 세우거나(3284e) 중간 저장 경기를 이어 세운다(0x327b8 모드 2 갈래).
 * 이어 세우는 길은 첫 그림을 비워 관리 화면이 한 번도 서지 않게 한다 — 그 동안 참을 낸다.
 */
export function useSeasonSceneEntry(session: SeasonSession): boolean {
  const { actions } = session
  /**
   * 메인 메뉴에서 들어오는 길 = 0x327b8(this, 2) 의 모드 2 갈래 — `+0x42 && +0x4e` 면 장면 0x105 를 세우지 않고 곧장 경기
   * 장면 0x104 다(메인 메뉴 시즌모드 0x24698 · [최근게임] 모드 2 가 같은 길). 첫 그림 전에 갈라 관리 화면이 한 번도 서지 않게
   * 첫 렌더는 비워 둔다.
   */
  const [isEnteringGame, setEnteringGame] = useState(() => session.isGameInProgress)
  /** 장면 0x105 를 세운 굴림은 들어올 때 한 번 (StrictMode 의 효과 다시 돌기에도) */
  const isSceneConstructed = useRef(false)
  /** 들어온 그림의 값 — 아래 들어올 때 한 번 도는 고리가 읽는다 */
  const enteredWith = useRef({ isEnteringGame, actions })
  useLayoutEffect(() => {
    const entered = enteredWith.current
    // 3284e — 중간 저장 경기(+0x42 && +0x4e)가 없으면 장면 0x105 를 세운다: 상태 1 적재 0x75fc 의 팁 rand(0, 73) 이 그 장면 맨 앞
    if (!entered.isEnteringGame) {
      if (!isSceneConstructed.current) entered.actions.constructScene()
      isSceneConstructed.current = true
      return
    }
    entered.actions.resumeSavedGame()
    // 0x327b8 모드 2 갈래 — 중간 저장 경기를 이어 세운 뒤에야 첫 그림을 낸다(첫 렌더는 비워 관리 화면이 한 번도 안 서게)
    setEnteringGame(false)
    // 들어올 때 한 번만 — 0x327b8 은 시즌모드에 들어오는 그 순간에만 돈다
  }, [])
  return isEnteringGame
}
