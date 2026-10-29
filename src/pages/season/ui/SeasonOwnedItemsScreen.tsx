import { useEffect, useEffectEvent, useState } from 'react'
import { RawScreen } from '@/shared/ui'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { seasonSubItemsOf } from '@/widgets/season/lib/seasonSubItems'
import { SeasonStatusPanel } from '@/pages/season/ui/SeasonStatusPanel'
import { SeasonCommandBar } from '@/pages/season/ui/SeasonCommonFrame'
import { seasonParentSlotOf } from '@/pages/season/lib/seasonCommandBar'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { ShopWindow } from '@/pages/shop/ui/ShopWindow'
import type { ShopEntry } from '@/pages/shop/lib/shopEntries'

/** 100만 원 → 만원 (소지금 = SR+2 × 100 만원) */
const MILLION_TO_TEN_THOUSAND = 100

export interface SeasonOwnedItemsScreenProps {
  readonly record: SeasonRecord
  readonly teamMorale: number
  readonly gamePoint?: number
  /** 0x5f10 — 취소(−16) → 0xcd */
  readonly onBack: () => void
}

/**
 * **시즌정보 → 아이템 (상태 0xd6)** — 보유 서브아이템 보기 (직접 떴다).
 *
 * ```
 * 0x5ee4 (들어옴)  창 종류 [win+0x1a4] = 5 · [win+0x1a8] = 1 · 0x81618(창)      ; 종류 5 는 1(서브아이템)·2 와 같은 5×2 격자
 * 0x5f10 (키)      취소(−16) → 0xcd · 그 밖 0x819ac(창, 키)                     ; 종류 1·2·5 는 격자 커서만 (0x819be 비트 0x26)
 * 0xb1b4 (그림)    상태판 0x7d34c · 커맨드 줄 0x7e418 · 아이템 창 0x8453c → 0x81dc0 · 머리띠 0x7f4ec
 * ```
 * 창 0x81dc0 의 종류 5 는 서브아이템 상점(종류 1)과 머리(img_text 105 "서브아이템" · 소지금 = SR+2 × 100 만원)가 같고,
 * 다른 점은 칸마다 **SR[0x58 + k] 가 서 있을 때만**(0x82542 `cmp r3,#0 ; bne` · `cmp r7,#1`) 아이콘을 그리고,
 * 커서 칸이 비었으면 이름·값·설명도 그리지 않는다(0x82646~0x82656). 종류 1 의 보유 표시 0xc3858 은 없다.
 * 사고팔기는 없다 — 키 0x5f10 은 0x13460(나리 상점)·0x957c(시즌 상점) 어느 쪽도 부르지 않는다.
 *
 * 창은 서브 · GP 상점과 같은 0x81dc0 이라 `ShopWindow`(종류 '보유')로 그린다 — 칸 바탕 0x7e764 를 10칸 모두에 깔고
 * (0x82420, 가졌든 아니든), 격자 커서는 목록 vt+0x1c(5, 2, 1, 꼴 0x30)대로 줄 · 열 안에서 감긴다(`movedSlotOf`).
 * 커맨드 줄 0x7e418 은 칸 수 0(0x7e84c 기본 갈래)이라 부모 칸 시즌정보만 그린다.
 */
export function SeasonOwnedItemsScreen({ record, teamMorale, gamePoint = 0, onBack }: SeasonOwnedItemsScreenProps) {
  const [cursor, setCursor] = useState(0)

  // 0x5f10 — 취소(−16) → 0xcd. 그 밖 키는 창 0x819ac(격자 커서) — `ShopWindow` 가 받는다
  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Escape' && event.key !== 'Backspace') return
    event.preventDefault()
    onBack()
  })
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleKey(event)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // 칸 k 는 SR[0x58 + k] 가 서 있을 때만 아이콘 · 이름 · 값 · 설명 (0x82542 · 0x82646)
  const entries: readonly (ShopEntry | null)[] = seasonSubItemsOf(record).map((item) =>
    item.isOwned
      ? {
          id: `시즌보유:${item.slot}`,
          name: item.name,
          description: item.description,
          price: item.price,
          iconFrame: item.iconFrame,
          isOwned: false,
          blockNotice: null,
        }
      : null,
  )

  return (
    <RawScreen>
      {/* 상태판 0x7d34c 를 먼저 그리고 그 위에 다른 것이 덮인다 (원본 그리기 차례) */}
      <SkinBackdrop kind="공무늬" />
      <SeasonStatusPanel record={record} teamMorale={teamMorale} />
      {/* 커맨드 줄 0x7e418 — 이 상태는 0x7e84c 가 칸 수를 0 으로 비워 하위 메뉴 객체의 부모 칸(시즌정보)만 (6, 245) 에 남는다 */}
      <SeasonCommandBar slots={[]} cursor={0} parent={seasonParentSlotOf('시즌정보')} />
      <div role="group" aria-label="보유 아이템">
        <ShopWindow
          kind="보유"
          entries={entries}
          cursor={cursor}
          onMoveCursor={setCursor}
          // 사고팔기는 없다 — 0x5f10 은 확인을 창에 넘길 뿐이다
          onSelect={() => undefined}
          money={record.money * MILLION_TO_TEN_THOUSAND}
          isKeyEnabled
        />
      </div>
      <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={onBack} footer={5} slides={false} />
    </RawScreen>
  )
}
