import type { Collection } from '@/entities/collection/model/collection'
import { useCallback } from 'react'
import { countSeasonRegularWin } from '@/entities/collection/model/collection'
import { hiddenOpenStoredIdOf } from '@/entities/collection/model/hiddenOpenNotice'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

type SetCollection = Dispatch<SetStateAction<Collection>>

interface HiddenOpenRefs {
  /** 판정이 읽는 지금 값 */
  readonly collectionRef: MutableRefObject<Collection>
  /** 이번 렌더 전에 이미 연 k */
  readonly openingRef: MutableRefObject<Set<number>>
  readonly announceRef: MutableRefObject<(ids: readonly number[], then?: (() => void) | null) => void>
  readonly setCollection: SetCollection
}

/** 히든 열기(알림 창 있고 없고) · 시즌 정규시즌 승리 수 — 지금 값은 ref 로 읽는다 */
export function useHiddenOpen({ collectionRef, openingRef, announceRef, setCollection }: HiddenOpenRefs) {
  /**
   * **`0x62368(ui, k, 0)` — 히든 k 를 열고 알림 창** (직접 떴다). 셋째 인자 0 이라 이미 열린 k(0x61f5c)면 아무것도 안 한다.
   * 새로 열면 전역 해금표(`app+0xc0`, 웹 `openedHiddenIds`)에 켜고 공용 창에 글을 띄운다(`hiddenOpenNoticeTextOf`).
   * 새로 열었으면 참 — 원본도 새로 열었을 때만 0 이 아닌 값을 돌려준다.
   * 히든 팀 k 8~12 는 웹 표의 팀 번호 10~14 로 적는다(`hiddenOpenStoredIdOf`). `then` 은 알림 창을 닫은 뒤 부른다 —
   * 새로 열지 않았으면 부르지 않으니(창이 없다) 부르는 쪽이 곧바로 잇는다.
   */
  const openHiddenQuietly = useCallback(
    (id: number): boolean => {
      const stored = hiddenOpenStoredIdOf(id)
      if (collectionRef.current.openedHiddenIds.includes(stored) || openingRef.current.has(stored)) return false
      openingRef.current.add(stored)
      setCollection((previous) =>
        previous.openedHiddenIds.includes(stored) ? previous : { ...previous, openedHiddenIds: [...previous.openedHiddenIds, stored] },
      )
      return true
    },
    [collectionRef, openingRef, setCollection],
  )
  const openHidden = useCallback(
    (id: number, then: (() => void) | null = null): boolean => {
      if (!openHiddenQuietly(id)) return false
      announceRef.current([id], then)
      return true
    },
    [announceRef, openHiddenQuietly],
  )

  /**
   * 시즌모드 정규시즌 경기 승리 (0x4ea0c 4f1e8~4f212) — 전역기록 +0xbf 를 올리고(100 상한) 100 이면 히든 45
   * (`countSeasonRegularWin`). 부르는 쪽(시즌 정산)이 모드 2 · 정규시즌 · 사람 팀 승리를 가린다.
   */
  const recordSeasonRegularWin = useCallback(() => {
    const counted = countSeasonRegularWin(collectionRef.current)
    collectionRef.current = counted.collection
    setCollection((previous) => countSeasonRegularWin(previous).collection)
    if (counted.hiddenId !== null) openHidden(counted.hiddenId)
  }, [collectionRef, openHidden, setCollection])

  return { openHiddenQuietly, openHidden, recordSeasonRegularWin }
}
