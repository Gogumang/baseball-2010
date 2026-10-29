import { selectShopItem } from '@/features/shop/model/shopSelection'
import { BATTER_GP_ITEMS } from '@/entities/career/model/gpItems'
import { BATTER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { shopGpDetailAtom, shopNoticeAtom } from '@/app/model/careerSession/atoms/uiAtoms'
import { useShownCareer } from '@/app/model/careerSession/state/useShownCareer'

/** [아이템] 상점 · [선수정보] 장비착용 (그림마다 새 함수 — 옛 꼴 그대로) */
export function useShopActions(scope: CareerScope) {
  const { atoms, random, recordStat, announceHiddenOpen, setScreen } = scope
  const career = useShownCareer(scope)
  const openShopTab = (tab: string) => {
    atoms.set(shopNoticeAtom, '')
    atoms.set(shopGpDetailAtom, null)
    setScreen({ kind: '아이템', tab })
  }
  return {
    /** [아이템] 하위 메뉴 → 그 탭의 상점 */
    openShop: openShopTab,

    /**
     * [선수정보] 하위 메뉴 106 중 관리 화면이 직접 띄우지 않는 칸 — 키 0x13010 점프표 0xcc69c 칸 1 [장비착용] → 121
     * (장착 상점 '착용' 탭). 나머지 칸 0 기본정보 119 · 2 아이템/스킬 122 · 3 필살타법 123 · 4 기록실(팝업 0x80 → 124)은
     * 관리 화면이 스스로 띄운다(`useManagementMenu`). 예전 웹 임시 '성적' 화면(R9 500행)은 원본 106 의 다섯 칸에 없는
     * 화면이라 걷었다 — 그 화면이 보이던 시즌·통산 성적은 124 기록실, 능력치는 119/120, 칭호는 129 가 보인다.
     */
    openPlayerInfo: (itemId: string) => {
      if (itemId === '장비착용') openShopTab('착용')
    },

    /** 상점에서 한 칸을 고른다 (장착·서브·GP — shopSelection) */
    purchase: (itemId: string) => {
      if (career === null) return
      const selection = selectShopItem(career, itemId, random)
      atoms.set(shopNoticeAtom, selection.notice)
      atoms.set(shopGpDetailAtom, selection.detail ?? null)
      atoms.set(rawCareerAtom, selection.career)
      // 장비 구매 0x14a74 — 구매 완료 창 없이, 새로 연 컬렉터마다 0x62368 → 공용 창(구매 확인 창이 닫힌 뒤 대기 칸에서 선다)
      if (selection.openedHiddenIds !== undefined && selection.openedHiddenIds.length > 0) announceHiddenOpen?.(selection.openedHiddenIds)
      // GP 칸 구매가 확정됐으면(G 를 뺐으면) 0x14ffe `0x22e35(모드 4, 칸)` → 0x1501e `0x22c29(1, 가격)`
      const [tab, first] = itemId.split(':')
      if (tab !== 'GP' || selection.career === career) return
      const index = Number(first)
      recordStat({ kind: 'GP아이템구매', mode: BATTER_LEAGUE_MODE, index, price: BATTER_GP_ITEMS[index].price })
    },

    /** GP 결과 창 닫기 — 콜백 0x1d649 는 팝업만 닫는다 (굴림 없음) */
    closeShopGpDetail: () => atoms.set(shopGpDetailAtom, null),
  }
}
