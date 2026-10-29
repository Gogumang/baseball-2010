import { useCallback } from 'react'
import { selectPitcherShopItem, type PitcherShopTab } from '@/features/shop/model/pitcherShopSelection'
import { BATTER_GP_ITEMS } from '@/entities/career/model/gpItems'
import { PITCHER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { sceneAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { shopGpDetailAtom, shopNoticeAtom, shopTabAtom } from '@/app/model/pitcherLeagueSession/atoms/uiAtoms'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'
import { useShownCareer } from '@/app/model/pitcherLeagueSession/state/useShownCareer'

/** 기록연감의 전역 해금 id 를 보이는 커리어 것에 얹는다 — 이미 다 있으면 그대로 */
function withGlobalOpenedHidden(shown: PitcherCareer, globalOpenedHiddenIds: readonly number[]): PitcherCareer {
  const missing = globalOpenedHiddenIds.filter((id) => !shown.openedHiddenIds.includes(id))
  return missing.length === 0 ? shown : { ...shown, openedHiddenIds: [...shown.openedHiddenIds, ...missing] }
}

/** GP 칸 구매 확정 — 0x14ffe `0x22e35(모드 3, 칸)` → 0x1501e `0x22c29(2, 가격)` (가격 표는 두 편 공용) */
function recordGpItemPurchase(itemId: string, recordStat: (event: AnnalsStatEvent) => void): void {
  const [tab, first] = itemId.split(':')
  if (tab !== 'GP') return
  const index = Number(first)
  recordStat({ kind: 'GP아이템구매', mode: PITCHER_LEAGUE_MODE, index, price: BATTER_GP_ITEMS[index].price })
}

/** 장비 구매 0x14a74 — 구매 완료 창 없이, 새로 연 컬렉터마다 0x62368 → 공용 창(구매 확인 창이 닫힌 뒤 대기 칸에서 선다) */
function announceOpenedCollectors(ids: readonly number[] | undefined, announceHiddenOpen: ((ids: readonly number[]) => void) | undefined): void {
  if (ids !== undefined && ids.length > 0) announceHiddenOpen?.(ids)
}

/** 111 장비 상점 · 121 장비착용 */
export function useShopActions(scope: PitcherScope) {
  const { atoms, random, recordStat, announceHiddenOpen } = scope
  const career = usePitcherValue(atoms, careerAtom)
  const shown = useShownCareer(scope)
  const { commit } = usePitcherSaveWriters(scope)
  const closeShopGpDetail = useCallback(() => atoms.set(shopGpDetailAtom, null), [atoms])
  /** [아이템] → 110 → 111 장비 상점 · [선수정보] → 121 장비착용. 취소는 `goto('관리')` — 관리 화면이 하위 메뉴로 선다(원본 111 → 110) */
  const openShop = useCallback(
    (tab: PitcherShopTab) => {
      atoms.set(shopTabAtom, tab)
      atoms.set(shopNoticeAtom, '')
      atoms.set(shopGpDetailAtom, null)
      atoms.set(sceneAtom, '상점')
    },
    [atoms],
  )
  /**
   * 장비·서브·GP 구매와 장비 착용. 바뀐 칸이 커리어에 들어가고 곧바로 저장한다
   * (원본 0x14a74 도 `0x22755(app, 1)` 로 바로 저장한다).
   * 해금표는 원본에서 전역이라 기록연감 것을 커리어 것에 얹어 판정하고, 얹은 채로 저장한다
   * (타자편 `syncOpenedHidden` 과 같은 방식).
   *
   * GP 아이템은 G 를 쓰고(전역 `mgr+0x64`) 또또상품권은 난수를 굴리므로 **한 번만** 고른다 —
   * 보이는 커리어(`shown`, G = 지갑 값)로 고르고 그 결과를 그대로 저장하면, 바뀐 G 는 지갑 다리가 지갑으로 옮긴다
   * (구질 훈련·마구 훈련이 G 를 쓰는 길과 같다). 장비 구매 0x14a74 — 구매 완료 창 없이, 새로 연 컬렉터마다 0x62368 → 공용 창.
   * G 를 안 쓴 칸(장비·서브·착용)은 저장의 G 칸을 건드리지 않는다 — `?무한G` 의 99999 가 저장에 새지 않게.
   */
  const purchase = useCallback(
    (itemId: string, globalOpenedHiddenIds: readonly number[] = []) => {
      if (career === null || shown === null) return
      const merged = withGlobalOpenedHidden(shown, globalOpenedHiddenIds)
      const selection = selectPitcherShopItem(merged, itemId, random)
      atoms.set(shopNoticeAtom, selection.notice)
      atoms.set(shopGpDetailAtom, selection.detail ?? null)
      if (selection.career === merged) return
      announceOpenedCollectors(selection.openedHiddenIds, announceHiddenOpen)
      const spentGamePoint = selection.career.gamePoint !== merged.gamePoint
      commit(spentGamePoint ? selection.career : { ...selection.career, gamePoint: career.gamePoint })
      if (spentGamePoint) recordGpItemPurchase(itemId, recordStat)
    },
    [announceHiddenOpen, atoms, career, commit, random, recordStat, shown],
  )
  return { openShop, purchase, closeShopGpDetail }
}
