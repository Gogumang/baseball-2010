import { PressArea } from '@/shared/ui'
import { tapKey } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { PAGER, TAB_PAGE_COUNTS } from '@/pages/record/lib/recordAnnalsLayout'
import * as styles from '@/pages/record/ui/RecordAnnals.css'
import { SLT_FRAME, imageSrc } from '@/pages/record/ui/recordAnnals/annalsAssets'

/** 웹 덧붙임 — 쪽 화살 그림(5×8) 위 투명 칸: 원본 ← · → 키 한 번. 같은 키를 상황 버튼으로 또 내지 않는다(r192, 필요한 버튼만) */
function PagerPressAreas() {
  return (
    <>
      <PressArea
        label="앞 쪽"
        rect={{ x: PAGER.leftArrow.x - 3, y: PAGER.leftArrow.y - 3, width: 11, height: 14 }}
        onPress={() => tapKey('ArrowLeft')}
      />
      <PressArea
        label="뒤 쪽"
        rect={{ x: PAGER.rightArrow.x - 3, y: PAGER.rightArrow.y - 3, width: 11, height: 14 }}
        onPress={() => tapKey('ArrowRight')}
      />
    </>
  )
}

/** 쪽 화살 · "쪽/전체" — 쪽이 없는 탭(진행 · 스킬)은 안 그린다. 쪽 번호 "/전체" 는 늘 표 값이다 */
export function AnnalsPager({ tab, page, isPanelOpen }: { readonly tab: number; readonly page: number; readonly isPanelOpen: boolean }) {
  const pageCount = TAB_PAGE_COUNTS[tab]
  if (pageCount <= 0) return null
  return (
    <>
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, PAGER.leftArrow.image)}
        style={{ left: PAGER.leftArrow.x, top: PAGER.leftArrow.y }}
      />
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, PAGER.rightArrow.image)}
        style={{ left: PAGER.rightArrow.x, top: PAGER.rightArrow.y, transform: 'scaleX(-1)' }}
      />
      <div className={styles.pagerText} style={{ left: PAGER.numberX, top: PAGER.y }}>
        {page + 1}/{pageCount}
      </div>
      {isPanelOpen && <PagerPressAreas />}
    </>
  )
}
