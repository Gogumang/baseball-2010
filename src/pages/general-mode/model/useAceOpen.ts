import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import {
  aceBatterIdsOf,
  acePitcherIdsOf,
  normalizeAceOpenSave,
  openAceCell,
} from '@/pages/general-mode/lib/aceOpenState'
import type { AceOpenSave } from '@/pages/general-mode/lib/aceOpenState'

export interface AceOpenSession {
  readonly save: AceOpenSave
  /** 화면이 받는 열린 마투수 로컬 번호 0~4 (저장 +0x30..0x34) */
  readonly openedAcePitcherIds: readonly number[]
  /** 열린 마타자 로컬 번호 0~4 (저장 +0x35..0x39) */
  readonly openedAceBatterIds: readonly number[]
  /** 플래그를 세우고 저장한다 (0xa3f6). G 를 빼는 것은 부르는 쪽 몫이다 */
  readonly open: (cell: number) => void
}

/**
 * 마선수 오픈 플래그 10칸(`mgr[0x30..0x39]`)을 들고 있는 저장 고리.
 *
 * 저장이 없던 시절의 세이브를 깨지 않는다 — `normalizeAceOpenSave` 가 빠진 칸을 채우고
 * 기본 개방 둘(칸 0 싸이커 · 5 메디카)을 늘 켠다.
 */
export function useAceOpen(store: JsonStorePort): AceOpenSession {
  const [save, setSave] = useState<AceOpenSave>(() => normalizeAceOpenSave(store.load()))

  useEffect(() => {
    store.save(save)
  }, [save, store])

  const open = useCallback((cell: number) => setSave((previous) => openAceCell(previous, cell)), [])
  const openedAcePitcherIds = useMemo(() => acePitcherIdsOf(save), [save])
  const openedAceBatterIds = useMemo(() => aceBatterIdsOf(save), [save])

  return { save, openedAcePitcherIds, openedAceBatterIds, open }
}
