import { useCallback } from 'react'
import type { SeasonGlobalSlots } from '@/app/model/seasonSession/save/globals'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'
import type { SeasonScope } from '@/app/model/seasonSession/atoms/seasonScope'
import { carriedGlobalsAtom, globalsAtom, persistedSaveAtom, saveAtom } from '@/app/model/seasonSession/atoms/saveAtoms'

/**
 * 시즌 저장 쓰기 넷 — 메모리 저장 객체(`saveAtom`)와 시즌 파일(저장소 한 칸, `persistedSaveAtom`)과 같이 실린 전역 칸(`globalsAtom`).
 * 원본은 저장 객체 고치기와 시즌 파일 쓰기(0x22754) · 전역 저장(0x1f1b9)이 따로다.
 */
export function useSeasonSaveWriters({ atoms, store }: SeasonScope) {
  /** 저장 객체를 고치고 시즌 파일을 쓴다 (0x1fded · 0x22755) */
  const commit = useCallback(
    (next: SeasonSave) => {
      atoms.set(persistedSaveAtom, next)
      atoms.set(saveAtom, next)
      store.save({ ...next, ...atoms.get(globalsAtom) })
    },
    [atoms, store],
  )
  /** 저장 객체(메모리)만 고친다 — 파일 쓰기는 다음 `commit` 이 한다 (원본의 저장 객체 고치기와 0x22754 사이) */
  const stageSave = useCallback((next: SeasonSave) => atoms.set(saveAtom, next), [atoms])
  /**
   * 시즌 저장소에 같이 실린 전역 칸 하나를 고치고 곧바로 쓴다 — 메모리 시즌에도 얹되 파일에는 마지막으로 쓴 시즌 위에만 얹는다
   * (`persistedSaveAtom`)
   */
  const writeGlobalField = useCallback(
    (patch: Partial<SeasonSave>) => {
      const current = atoms.get(saveAtom)
      const persisted = atoms.get(persistedSaveAtom)
      if (current !== null) stageSave({ ...current, ...patch })
      if (persisted !== null) atoms.set(persistedSaveAtom, { ...persisted, ...patch })
      store.save({ ...(persisted ?? atoms.get(carriedGlobalsAtom)), ...patch, ...atoms.get(globalsAtom) })
    },
    [atoms, stageSave, store],
  )
  /** 전역기록 칸(`SeasonGlobalSlots`)을 고치고 곧바로 저장한다 — 원본도 쓰는 그 자리에서 전역 저장 0x1f1b9 를 부른다 */
  const updateGlobals = useCallback(
    (change: (current: SeasonGlobalSlots) => SeasonGlobalSlots) => {
      const before = atoms.get(globalsAtom)
      const next = change(before)
      if (next === before) return
      atoms.set(globalsAtom, next)
      // 메모리에만 고친 시즌(`stageSave`)은 싣지 않는다 — 전역 저장 0x1f1b9 는 시즌 파일을 안 쓴다
      store.save({ ...(atoms.get(persistedSaveAtom) ?? atoms.get(carriedGlobalsAtom)), ...next })
    },
    [atoms, store],
  )
  return { commit, stageSave, writeGlobalField, updateGlobals }
}
