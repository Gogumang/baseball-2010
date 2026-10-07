import { useEffect, useRef, useState } from 'react'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import {
  EMPTY_RECORD_ALERT, accrueRecordGamePoint, drawRecordAlert, fillRecordAlertSlots,
} from '@/widgets/game-scene/lib/recordAlert'
import type { RecordAlertFrame, RecordAlertState } from '@/widgets/game-scene/lib/recordAlert'

const NO_FRAME: RecordAlertFrame = { panel: null, rows: [] }

/**
 * **경기 중 기록 달성 알림 0x4e35c 의 상태** — 진행기가 쌓는 이번 경기 기록 번호(`recordIds`, 달성 차례)가 늘면
 * 0xa77f0 처럼 G 누계에 더하고 0x4e600 처럼 빈 칸에 넣는다. `isDrawing`(상태 0x17 수비 인플레이가 아니다) 동안
 * 갱신마다 0x4e35c 를 한 번 돌린다. `isFrozen` 은 [0x140005c]+9 ≠ 0 — 그리기만 하고 폭·시간을 안 올린다.
 *
 * - 처음 붙을 때의 `recordIds` 는 이미 지난 것으로 본다(이어하기로 경기 중간에 들어와도 다시 띄우지 않는다).
 * - `isSettled`(경기 끝 — 상태 0x19 정산)면 0x4e600 이 줄을 그대로 둔다 → 새 칸을 안 넣는다.
 * ⚠️ 근사: 원본은 줄을 사람 타석이 끝날 때(0x4e6d4 · 0x528b0)만 칸으로 옮긴다 — 자동 타석(0x21)에서 쌓인 기록은 다음 사람
 *    타석이 끝날 때 뜬다. 웹은 기록이 진행기에 들어온 뒤 화면이 처음 볼 때 넣는다. 노랑 줄을 고르는 틱도 장면 상태 틱
 *    [+0x2c] 대신 이 훅이 센 갱신 수다. 시뮬 +0 바이트(자동진행) 갈래 — 줄 버리기 · 누계 0 — 는 화면이 그 값을 안 들고 있어
 *    잇지 않았다.
 */
export function useRecordAlert(
  recordIds: readonly number[],
  { isDrawing, isFrozen = false, isSettled = false }: {
    readonly isDrawing: boolean
    readonly isFrozen?: boolean
    readonly isSettled?: boolean
  },
): RecordAlertFrame {
  const stateRef = useRef<RecordAlertState>(EMPTY_RECORD_ALERT)
  const seenRef = useRef(recordIds.length)
  const frozenRef = useRef(isFrozen)
  frozenRef.current = isFrozen
  const [frame, setFrame] = useState<RecordAlertFrame>(NO_FRAME)

  useEffect(() => {
    if (recordIds.length < seenRef.current) {
      // 새 경기 — 번호 목록이 새로 시작했다 (장면 시작 0x3d6f4 가 칸과 누계를 비운다)
      seenRef.current = 0
      stateRef.current = { ...EMPTY_RECORD_ALERT, widths: stateRef.current.widths }
    }
    if (recordIds.length === seenRef.current) return
    const added = recordIds.slice(seenRef.current)
    seenRef.current = recordIds.length
    const accrued = accrueRecordGamePoint(stateRef.current, added)
    stateRef.current = isSettled ? accrued : fillRecordAlertSlots(accrued, added)
  }, [recordIds, isSettled])

  useSceneTick((tick) => {
    const drawn = drawRecordAlert(stateRef.current, tick, frozenRef.current)
    stateRef.current = drawn.next
    // 빈 그림이 이어지면 다시 그리지 않는다 — 부르는 화면을 갱신마다 다시 그리지 않게
    setFrame((previous) => (previous.panel === null && drawn.frame.panel === null ? previous : drawn.frame))
  }, isDrawing)

  return isDrawing ? frame : NO_FRAME
}
