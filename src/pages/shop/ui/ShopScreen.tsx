import { useState } from 'react'
import { Button, Hint, MenuList, MessageBox, Notice, Panel, PixelScreen, StatusBar } from '@/shared/ui'
import type { MenuItem } from '@/shared/ui'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { SUB_ITEMS, hasSubItem } from '@/entities/career/model/subItems'
import { BATTER_GP_ITEMS } from '@/entities/career/model/gpItems'
import { EQUIPMENT_PARTS } from '@/entities/career/model/equipment'
import { purchaseQuestionOf, shopItemId } from '@/features/shop/model/shopSelection'
import type { ShopTab } from '@/features/shop/model/shopSelection'
import { equipmentMenuOf, formatMoney } from '@/pages/shop/lib/shopMenu'
import { ItemShopScreen } from '@/pages/shop/ui/ItemShopScreen'
import * as styles from '@/pages/shop/ui/ShopScreen.css'

interface ShopScreenProps {
  /** 관리 화면 [아이템] 하위 메뉴에서 고른 탭 */
  readonly initialTab: string
  readonly career: PlayerCareer
  readonly noticeText: string
  readonly onPurchase: (itemId: string) => void
  readonly onBack: () => void
}

const TABS: readonly ShopTab[] = ['장착', '서브', 'GP']
const WEARING_TAB = '착용'
const TAB_LABEL: Readonly<Record<ShopTab, string>> = { 장착: '장착 아이템', 서브: '서브 아이템', GP: 'GP 아이템', 착용: '장비착용' }

/**
 * 나만의리그 [아이템] (0x14a74). [서브]·[GP] 는 원본 아이템 창(0x81dc0)으로 보낸다.
 * [장착]·[장비착용] 은 아직 웹 목록이다 — 원본은 따로 있는 장비 목록 화면(0x83378)이라 다음에 옮긴다.
 */
export function ShopScreen({ initialTab, career, noticeText, onPurchase, onBack }: ShopScreenProps) {
  if (initialTab === '서브' || initialTab === 'GP') {
    return <ItemShopScreen tab={initialTab} career={career} noticeText={noticeText} onPurchase={onPurchase} onBack={onBack} />
  }
  return <EquipmentShopScreen initialTab={initialTab} career={career} noticeText={noticeText} onPurchase={onPurchase} onBack={onBack} />
}

/** 장착·장비착용 목록 (아직 웹 임의 화면) */
function EquipmentShopScreen({ initialTab, career, noticeText, onPurchase, onBack }: ShopScreenProps) {
  const isWearing = initialTab === WEARING_TAB
  const [tab, setTab] = useState<ShopTab>(TABS.find((candidate) => candidate === initialTab) ?? '장착')
  const [part, setPart] = useState(0)
  const [pending, setPending] = useState<{ itemId: string; question: string } | null>(null)
  // 살 수 있는 칸은 StrMODE[79] 로 한 번 묻는다. 막힘 알림·다시 끼기는 바로 넘긴다
  const select = (itemId: string) => {
    const question = purchaseQuestionOf(career, itemId)
    if (question === null) onPurchase(itemId)
    else setPending({ itemId, question })
  }

  const subItems: MenuItem[] = SUB_ITEMS.map((item) => ({
    id: shopItemId('서브', item.id),
    label: item.name,
    detail: hasSubItem(career, item.id) ? `보유 중 · ${item.effectText}` : item.effectText,
    cost: formatMoney(item.price),
  }))
  const gpItems: MenuItem[] = BATTER_GP_ITEMS.map((item) => ({
    id: shopItemId('GP', item.id),
    label: item.name,
    detail: item.effectText,
    cost: `${item.price}G`,
    isDisabled: career.gamePoint < item.price,
  }))

  return (
    <PixelScreen title={isWearing ? '장비착용' : '아이템'} rightKey={{ label: '돌아가기', onPress: onBack }}>
      <StatusBar career={career} />
      {!isWearing && <div className={styles.tabs} role="tablist">
        {TABS.map((candidate) => (
          <Button key={candidate} variant="segment" role="tab" aria-selected={candidate === tab}
            className={styles.compactTab} onClick={() => setTab(candidate)}>
            {TAB_LABEL[candidate]}
          </Button>
        ))}
      </div>}
      {noticeText !== '' && (
        <Panel>
          <Notice>{noticeText}</Notice>
        </Panel>
      )}
      {tab === '장착' && (
        <>
          <div className={styles.tabs} role="tablist">
            {EQUIPMENT_PARTS.map((candidate) => (
              <Button key={candidate.index} variant="segment" role="tab" aria-selected={candidate.index === part}
                className={styles.compactTab} onClick={() => setPart(candidate.index)}>
                {candidate.name}
              </Button>
            ))}
          </div>
          <MenuList items={equipmentMenuOf(career, part, isWearing)} onSelect={select} />
          <Hint>소지금 {formatMoney(career.money)} · 산 장비는 다시 골라 장착할 수 있습니다</Hint>
        </>
      )}
      {tab === '서브' && <MenuList items={subItems} onSelect={select} />}
      {tab === 'GP' && <MenuList items={gpItems} onSelect={select} />}
      {pending !== null && (
        <MessageBox
          text={pending.question}
          buttons={['예', '아니오']}
          onAnswer={(index) => {
            if (index === 0) onPurchase(pending.itemId)
            setPending(null)
          }}
        />
      )}
    </PixelScreen>
  )
}
