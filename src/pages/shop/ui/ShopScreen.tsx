import { useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { EQUIPMENT_PARTS } from '@/entities/career/model/equipment'
import { purchaseQuestionOf } from '@/features/shop/model/shopSelection'
import type { ShopTab } from '@/features/shop/model/shopSelection'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { shopEntriesOf, windowKindNameOf } from '@/pages/shop/lib/shopEntries'
import { ShopWindow } from '@/pages/shop/ui/ShopWindow'

interface ShopScreenProps {
  /** 관리 화면 [아이템] 하위 메뉴에서 고른 탭 */
  readonly initialTab: string
  readonly career: PlayerCareer
  readonly noticeText: string
  readonly onPurchase: (itemId: string) => void
  readonly onBack: () => void
}

const TABS: readonly ShopTab[] = ['장착', '서브', 'GP', '착용']
const PART_NAMES = EQUIPMENT_PARTS.map((part) => part.name)

/**
 * 상점·아이템 창 (0x8453c → 0x81dc0). 관리 화면 [아이템] 의 네 갈래가 모두 여기로 온다:
 *   창 종류 1 서브아이템 · 2 GP아이템 · 3 장비 상점 / 장비착용 (R12 1a)
 *   — 종류 4 구장 아이템(0x83378, 프레임 32)은 시즌 구단관리 쪽이라 웹에 아직 데이터가 없다.
 *     배치 좌표만 `shopLayout.STADIUM_BOXES` 에 넣어 뒀다.
 *
 * 창은 **mode_ui 프레임 33 박스 6개 + 프레임 34 격자 10칸** 으로 그린다 (P6 3절).
 * 앞서 웹은 글자 탭 + MenuList 였다.
 */
export function ShopScreen({ initialTab, career, noticeText, onPurchase, onBack }: ShopScreenProps) {
  const tab = TABS.find((candidate) => candidate === initialTab) ?? '장착'
  const [part, setPart] = useState(0)
  const [cursor, setCursor] = useState(0)
  const [pending, setPending] = useState<{ readonly itemId: string; readonly question: string } | null>(null)
  /** 가드에 걸린 칸의 안내 — 원본 0x13460 은 여기서 1버튼 팝업만 띄우고 사지 않는다 */
  const [blockNotice, setBlockNotice] = useState<string | null>(null)
  const [dismissedNotice, setDismissedNotice] = useState('')

  const entries = shopEntriesOf({ tab, career, part })
  const isNoticeOpen = noticeText !== '' && noticeText !== dismissedNotice

  const select = (index: number) => {
    const entry = entries[index]
    if (entry === undefined) return
    // 서브·GP 는 막힘 문구가 entities 쪽에 그대로 있어 창이 바로 띄운다.
    // 장비는 문구가 features/shop 안에만 있어서 예전처럼 부모가 만들게 둔다 (규칙을 두 번 적지 않으려고).
    if (entry.blockNotice !== null) {
      setBlockNotice(entry.blockNotice)
      return
    }
    // 살 수 있는 칸은 StrMODE[79]·[82] 로 한 번 묻는다
    const question = purchaseQuestionOf(career, entry.id)
    if (question === null) onPurchase(entry.id)
    else setPending({ itemId: entry.id, question })
  }

  const changePart = (next: number) => {
    setPart(next)
    setCursor(0)
  }

  return (
    <RawScreen>
      <ShopWindow
        kind={windowKindNameOf(tab)}
        entries={entries}
        cursor={cursor}
        onMoveCursor={setCursor}
        onSelect={select}
        money={career.money}
        isKeyEnabled={pending === null && blockNotice === null && !isNoticeOpen}
        partTabs={tab === '장착' || tab === '착용'
          ? { names: PART_NAMES, current: part, onChange: changePart }
          : undefined}
      />
      <ScreenFrame title="나만의리그타자편" gamePoint={career.gamePoint} onBack={onBack} />
      {pending !== null && (
        <MessageBox text={pending.question} buttons={['예', '아니오']}
          onAnswer={(index) => {
            if (index === 0) onPurchase(pending.itemId)
            setPending(null)
          }} />
      )}
      {pending === null && blockNotice !== null && (
        <MessageBox text={`!C${blockNotice}`} buttons={['확인']} onAnswer={() => setBlockNotice(null)} />
      )}
      {pending === null && blockNotice === null && isNoticeOpen && (
        <MessageBox text={`!C${noticeText}`} buttons={['확인']} onAnswer={() => setDismissedNotice(noticeText)} />
      )}
    </RawScreen>
  )
}
