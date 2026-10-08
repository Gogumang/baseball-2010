import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import type { MenuSlot } from '@/pages/management/lib/managementLayout'
import { seasonStageCharactersOf } from '@/pages/management/lib/centerStage'
import { CommandBar } from '@/pages/management/ui/CommandBar'
import { CenterStage } from '@/pages/management/ui/CenterStage'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { SeasonStatusPanel } from '@/pages/season/ui/SeasonStatusPanel'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'

/** 커서를 옮긴 뒤 두 번 그리는 동안 +1, −1 로 튄다 (0x7e47a — 카운터 [gfx+0x98] 0 → +1 · 1 → −1) */
const BOUNCE_BY_UPDATE = [1, -1]

export interface SeasonCommandBarProps {
  readonly slots: readonly MenuSlot[]
  readonly cursor: number
  /** 하위 메뉴의 부모 칸(관리 메뉴 커서 칸) — 없으면 메인 메뉴 */
  readonly parent: MenuSlot | null
  readonly disabledIds?: ReadonlySet<string>
  /** 흑백으로 그리기만 하는 칸 (0xce 하위 메뉴 켬 표 — 키는 막지 않는다) */
  readonly grayedIds?: ReadonlySet<string>
  readonly onHover?: (index: number) => void
  readonly onSelect?: (id: string) => void
  /**
   * 칸 등장의 틀 수 — 0x7e418 의 둘째 인자 [this+0x2c](지금 상태의 틀 수). 안 주면 화면이 선 뒤 갱신 수다. 이벤트 재생 0xd3 의
   * 끝 틀처럼 그 상태가 오래 서 있던 뒤에 한 틀만 그리는 자리는 큰 값을 준다
   */
  readonly slideUpdates?: number
}

const NO_IDS: ReadonlySet<string> = new Set()

/**
 * 시즌 커맨드 줄 — 공용 0x7e418(`CommandBar`)에 시즌 표(`lib/seasonCommandBar`)를 넘긴다.
 * 칸 등장(0x7ff8c · 부모 칸 0x8003c)은 상태의 틀 수 [this+0x2c] 로 그린다 — 화면이 서고 난 갱신 수.
 */
export function SeasonCommandBar({
  slots, cursor, parent, disabledIds = NO_IDS, grayedIds, onHover, onSelect, slideUpdates,
}: SeasonCommandBarProps) {
  const update = useUpdateCounter()
  const labelOrigins = useFrameOrigins('./sprites/img_text/frames')
  const [movedAt, setMovedAt] = useState<number | null>(null)
  const lastCursor = useRef(cursor)
  const latestUpdate = useRef(update)
  latestUpdate.current = update
  // 메뉴 +0x25(바뀜) 가 서면 [gfx+0x98] = 0 (0x9008 · 0x8f30 의 그 밖 키 갈래)
  useEffect(() => {
    if (lastCursor.current === cursor) return
    lastCursor.current = cursor
    setMovedAt(latestUpdate.current)
  }, [cursor])
  const labelWidths = Object.fromEntries(
    slots.map((slot) => [slot.labelFrame, labelOrigins?.[String(slot.labelFrame).padStart(3, '0')]?.width ?? 0]),
  )
  return (
    <CommandBar slots={slots} cursor={cursor}
      bounce={movedAt === null ? 0 : (BOUNCE_BY_UPDATE[update - movedAt] ?? 0)}
      slideUpdates={slideUpdates ?? update} disabledIds={disabledIds} grayedIds={grayedIds} labelWidths={labelWidths} parent={parent}
      onHover={onHover ?? (() => undefined)} onSelect={onSelect ?? (() => undefined)} />
  )
}

export interface SeasonCommonFrameProps {
  readonly record: SeasonRecord
  readonly teamMorale: number
  /** 머리띠 G포인트 (저장 +0x64) */
  readonly gamePoint: number
  readonly commandBar: SeasonCommandBarProps
  /**
   * 가운데 판 0x7f814 를 그리는가 — 공통 틀이 0xd3 · 0xde · 0xe3 · 0xee 에서 뺀다. 0xb1b4(0xd6)·0xb1f8(0xdc)는 안 부른다.
   */
  readonly showsCenterStage?: boolean
  /** 0x8a2d8 을 거쳐 들어왔는가 — 관리 메뉴 0xc9 진입의 이전 상태가 1 · 0xd3 · 0xcb · 0xf5 · 0xf1 */
  readonly centerSlidesIn?: boolean
  /** 바닥 되돌아가기 (바닥비트 5) — 취소(−16)와 같은 곳 */
  readonly onBack: (() => void) | null
  /** 상태판과 머리띠 사이에 그리는 것 (아이템 창 0x8453c 등) */
  readonly children?: ReactNode
  /** 머리띠 위에 얹는 팝업 */
  readonly overlay?: ReactNode
}

/**
 * 시즌 공통 틀 **0x9f60** (상태 0xc9 · 0xcd · 0xce · 0xcf · 0xd0 · …, 직접 떴다):
 * ```
 * 공통 앞그림 0xb810   0xdd · 0xe0 · 0xe1 밖이면 공 무늬 0x5fd61(skin, 0, 0, W, H) · 판에 머리띠 (제목 10 시즌모드, 바닥 5)
 * 0x7e418(gfx, [this+0x2c])                     ; 커맨드 줄
 * 0x7d34c(gfx, 0)                               ; 상태판
 * 상태 ∉ {0xd3, 0xde, 0xe3, 0xee} → 0x7f814(gfx, [this+0x2c], 이전 상태 == 0xd3 ? 0 : 1)   ; 가운데 판
 * 0x7f4ec(gfx)                                  ; 머리띠 0x54d95
 * ```
 * 가운데 판의 a == 0 && b == 0(이벤트에서 막 돌아온 첫 틀)에는 안 그린다 — 한 틀이라 웹은 따지지 않는다.
 * 상태 0xd6(0xb1b4) · 0xdc 서브/GP(0xb1f8)도 같은 차례로 커맨드 줄 · 상태판 · 창 · 머리띠를 그린다(가운데 판 없음).
 */
export function SeasonCommonFrame({
  record, teamMorale, gamePoint, commandBar, showsCenterStage = true, centerSlidesIn = false, onBack, children, overlay,
}: SeasonCommonFrameProps) {
  return (
    <>
      <SkinBackdrop kind="공무늬" />
      <SeasonCommandBar {...commandBar} />
      <SeasonStatusPanel record={record} teamMorale={teamMorale} />
      {showsCenterStage && (
        <CenterStage slidesIn={centerSlidesIn}
          characters={seasonStageCharactersOf({ teamMorale, illness: record.illness, coach: record.coach })} />
      )}
      {children}
      <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={onBack} footer={5} />
      {overlay}
    </>
  )
}
