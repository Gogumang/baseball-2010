import { useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { SUB_ITEMS, hasSubItem } from '@/entities/career/model/subItems'
import { BATTER_GP_ITEMS } from '@/entities/career/model/gpItems'
import { purchaseQuestionOf, shopItemId } from '@/features/shop/model/shopSelection'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { ItemWindow } from '@/widgets/item-window/ui/ItemWindow'
import type { ItemWindowEntry } from '@/widgets/item-window/ui/ItemWindow'

interface ItemShopScreenProps {
  readonly tab: '서브' | 'GP'
  readonly career: PlayerCareer
  readonly noticeText: string
  readonly onPurchase: (itemId: string) => void
  readonly onBack: () => void
}

/** 아이템 창 화면 (0x81dc0) — 관리 메뉴 [아이템] 의 [서브]·[GP] 가 온다 */
export function ItemShopScreen({ tab, career, noticeText, onPurchase, onBack }: ItemShopScreenProps) {
  const [pending, setPending] = useState<{ itemId: string; question: string } | null>(null)
  const [dismissedNotice, setDismissedNotice] = useState('')
  const entries = tab === '서브' ? subEntriesOf(career) : gpEntries

  // 살 수 있는 칸은 StrMODE[79] 로 한 번 묻는다. 막힘 알림은 바로 넘긴다
  const select = (index: number) => {
    const itemId = tab === '서브' ? shopItemId('서브', SUB_ITEMS[index].id) : shopItemId('GP', BATTER_GP_ITEMS[index].id)
    const question = purchaseQuestionOf(career, itemId)
    if (question === null) onPurchase(itemId)
    else setPending({ itemId, question })
  }

  return (
    <RawScreen>
      <ItemWindow tab={tab} entries={entries} money={career.money} onSelect={select} />
      <ScreenFrame title="나만의리그타자편" gamePoint={career.gamePoint} onBack={onBack} />
      {pending !== null && (
        <MessageBox text={pending.question} buttons={['예', '아니오']}
          onAnswer={(index) => {
            if (index === 0) onPurchase(pending.itemId)
            setPending(null)
          }} />
      )}
      {pending === null && noticeText !== '' && noticeText !== dismissedNotice && (
        <MessageBox text={`!C${noticeText}`} buttons={['확인']} onAnswer={() => setDismissedNotice(noticeText)} />
      )}
    </RawScreen>
  )
}

function subEntriesOf(career: PlayerCareer): readonly ItemWindowEntry[] {
  return SUB_ITEMS.map((item) => ({
    name: item.name,
    description: item.effectText,
    price: item.price,
    isOwned: hasSubItem(career, item.id),
  }))
}

const gpEntries: readonly ItemWindowEntry[] = BATTER_GP_ITEMS.map((item) => ({
  name: item.name,
  description: item.effectText,
  price: item.price,
  isOwned: false,
}))
