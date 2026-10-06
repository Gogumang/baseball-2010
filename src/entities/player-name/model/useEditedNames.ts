import { useCallback, useState } from 'react'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import { clearEditedNames, normalizeEditedNames, withEditedName } from '@/entities/player-name/model/editedNames'
import type { EditedNameTable } from '@/entities/player-name/model/editedNames'
import { activeEditedNames, setActiveEditedNames } from '@/entities/player-name/model/playerName'

export interface EditedNamesSession {
  readonly table: EditedNameTable
  /** 이름 저장 `0xaa4ad(표, id, 글, 투수?)` 뒤 파일 저장 `0x1f1b9` — 고치는 즉시 저장한다 */
  readonly rename: (id: number, isPitcher: boolean, name: string) => void
  /** 에디트 초기화 `0x204c1` (환경설정 모드 초기화 StrMAINMENU[84]) */
  readonly clear: () => void
}

/**
 * 에디트 이름표 저장 고리. 처음 설 때 저장을 읽어 **공용 이름 함수(`playerNameOf`)가 보는 표**에 바로 꽂는다 —
 * 그래야 어느 화면이 먼저 그려지든 고친 이름이 나온다.
 */
export function useEditedNames(store: JsonStorePort): EditedNamesSession {
  const [table, setTable] = useState<EditedNameTable>(() => {
    const loaded = normalizeEditedNames(store.load())
    setActiveEditedNames(loaded)
    return loaded
  })

  const commit = useCallback((next: EditedNameTable) => {
    setActiveEditedNames(next)
    store.save(next)
    setTable(next)
  }, [store])

  const rename = useCallback(
    (id: number, isPitcher: boolean, name: string) => commit(withEditedName(activeEditedNames(), id, isPitcher, name)),
    [commit],
  )
  const clear = useCallback(() => commit(clearEditedNames()), [commit])

  return { table, rename, clear }
}
