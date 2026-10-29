import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { type SeasonMenuCursors, menuCursorsOnEnter } from '@/entities/season-mode/model/seasonStateMachine'
import { type SeasonScope, useSeasonValue } from '@/app/model/seasonSession/atoms/seasonScope'
import { rewardRecordAtom, saveAtom } from '@/app/model/seasonSession/atoms/saveAtoms'
import { sceneAtom } from '@/app/model/seasonSession/atoms/sceneAtoms'
import { menuCursorsAtom } from '@/app/model/seasonSession/atoms/uiAtoms'

/** 리그 1위 G 받은 문턱(전역 저장 +0x145)이 바뀌면 보상 저장소에 쓴다 */
export function useRewardRecordStore({ atoms, rewardStore }: SeasonScope): void {
  const rewardRecord = useSeasonValue(atoms, rewardRecordAtom)
  useEffect(() => {
    rewardStore?.save(rewardRecord)
  }, [rewardRecord, rewardStore])
}

/** 관리 메뉴·구단관리 메뉴 커서 — 상태가 바뀌면 진입 갈래(0x4efc · 0x47d8)가 이전 상태 this+0x24 를 보고 커서를 고친다 */
export function useMenuCursors({ atoms }: SeasonScope) {
  const scene = useSeasonValue(atoms, sceneAtom)
  const save = useSeasonValue(atoms, saveAtom)
  const previousScene = useRef(scene)
  useLayoutEffect(() => {
    const previous = previousScene.current
    if (previous === scene) return
    previousScene.current = scene
    const record = save?.state.record
    if (record === undefined) return
    atoms.set(menuCursorsAtom, (cursors) => menuCursorsOnEnter(cursors, scene, previous, record))
  }, [atoms, save, scene])
  const moveMenuCursor = useCallback(
    (menu: keyof SeasonMenuCursors, index: number) => {
      atoms.set(menuCursorsAtom, (cursors) => ({ ...cursors, [menu]: index }))
    },
    [atoms],
  )
  return { moveMenuCursor }
}
