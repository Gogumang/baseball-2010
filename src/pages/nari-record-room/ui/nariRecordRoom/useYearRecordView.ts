import { useEffect, useEffectEvent, useState } from 'react'
import { setAppTickInterval } from '@/shared/lib/frameClock/frameClock'
import { addSkinStepCounter, useMirrorSkinStepCounter } from '@/shared/lib/skinStepCounter/skinStepCounter'
import { OPEN_YEAR_RECORD_VIEW, advanceYearSlide, pressYearRecordKey } from '@/pages/nari-record-room/lib/nariRecordRoom'
import type { YearRecordView } from '@/pages/nari-record-room/lib/nariRecordRoom'
import { YEAR_KEYS, isCancelKey } from '@/pages/nari-record-room/ui/nariRecordRoom/yearRecordConstants'

/** 0x1463c 가 버리는 키 — [+0x164] == 0 갈래의 '0'(0x30) · '*'(0x2a) (1465e~14664) */
const isDroppedKey = (key: string) => ['0', '*'].includes(key)

/**
 * 124 첫 갈래의 목록 상태 — 키 0x1463c → 0x55864 · 밀기 한 단계 = 그림 한 번(5cd84 · 5cefa) · [편집기+0x40c] 거울.
 * 키는 잡는 단계에서 다 가져간다(관리 메뉴가 같은 키를 받지 않게).
 */
export function useYearRecordView(rowCount: number, columnCount: number, onBack: () => void): YearRecordView {
  const [view, setView] = useState<YearRecordView>(OPEN_YEAR_RECORD_VIEW)
  const latest = useEffectEvent(() => ({ onBack, rowCount }))

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 줄 수는 키를 받은 때의 값 — 갱신 함수는 렌더 중에 돌 수 있어 미리 꺼내 둔다
      const { onBack: back, rowCount: heldRowCount } = latest()
      // 0x1463c: 취소(−16)는 106 을 걸고 **돌아가지 않고** 아래로 흐른다(14644~1464c 뒤 14650) — [+0x164] == 0 갈래에서 '0'(0x30) ·
      // '*'(0x2a) 만 버리고(1465e~14664) 취소를 포함한 나머지는 0x55865 로 간다. 0x55864 머리가 [+0x40c] += 1(55868~55874) 한 뒤
      // 취소는 보기 전용 갈래 558d6 → 55908([+0x418] == −1 → +0x338 = 1)뿐이라 판은 그대로다 — 곧 취소도 한 번 센다(r168).
      if (isCancelKey(event.key)) {
        addSkinStepCounter()
        setView((held) => pressYearRecordKey(held, '기타', heldRowCount))
        back()
      } else {
        const key = YEAR_KEYS[event.key]
        if (key !== undefined) setView((held) => pressYearRecordKey(held, key, heldRowCount))
        else if (!isDroppedKey(event.key)) return
      }
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  // 밀기 한 단계 = 그림 한 번 (5cd84 · 5cefa)
  const isSliding = view.slide !== null
  useEffect(() => {
    if (!isSliding) return undefined
    const timer = setAppTickInterval(() => setView((held) => advanceYearSlide(held, columnCount)))
    return () => timer()
  }, [isSliding, columnCount])

  // [편집기+0x40c] 는 전역 스킨 칸 — 0x5561c 의 0 에서 센 값을 옮겨 다음 화면이 잇게 한다 (`shared/lib/skinStepCounter`)
  useMirrorSkinStepCounter(view.keyPresses)
  return view
}
