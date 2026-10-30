import { useState } from 'react'
import { ScreenOverlay } from '@/shared/ui'
import { RecordPickPopup } from '@/widgets/record-pick-popup'
import { RECORD_ROOM_PICK, RECORD_ROOM_PICK_LABEL_FRAMES, RECORD_ROOM_PICK_LABELS } from '@/pages/nari-record-room/lib/nariRecordRoom'
import type { RecordRoomPick } from '@/pages/nari-record-room/lib/nariRecordRoom'

export interface NariRecordPickPopupProps {
  /** 확인(−5 · '5') → [장면+0x164] = (+0x166 ? 1 : 0) · 124 */
  readonly onChoose: (pick: RecordRoomPick) => void
  /** 취소 → 팝업만 닫는다(106 그대로) */
  readonly onCancel: () => void
  /** 확인 뒤 창이 124 위에서 다 줄어들었다 */
  readonly onClosed: () => void
}

/**
 * 팝업 0x80 그림 0x19448 · 키 0x196ec — 시즌 0xf334 · 0xf5d4 와 같은 꼴에 글만 106 "개인기록" · 360 "순위기록"
 * (`widgets/record-pick-popup` 머리말). 고른 칸은 [장면+0x166] == 0 이면 칸 0.
 */
export function NariRecordPickPopup({ onChoose, onCancel, onClosed }: NariRecordPickPopupProps) {
  /** [장면+0x166] — 팝업을 열 때 0 (130d4~130dc) */
  const [pick, setPick] = useState<RecordRoomPick>(RECORD_ROOM_PICK.개인기록)
  // 확인 키가 그 갱신에 124 를 걸어(0x19736~0x19750) 다음 틀에 아래 화면이 124 로 갈려도 창은 그 위에서 줄어든다 —
  // 화면 갈래 밖 한 자리(240×320 화면 버퍼 자리)에 그린다. 부르는 쪽도 갈래 밖 같은 자리에 둔다
  return (
    <ScreenOverlay>
      <div style={{ position: 'absolute', left: 0, top: 'calc(50% - 160px)', width: 240, height: 320, pointerEvents: 'none' }}>
        <RecordPickPopup
          ariaLabel="기록실"
          testIdPrefix="기록실"
          selected={pick}
          closeKind="줄임"
          cells={[
            { label: RECORD_ROOM_PICK_LABELS[0], labelFrame: RECORD_ROOM_PICK_LABEL_FRAMES[0] },
            { label: RECORD_ROOM_PICK_LABELS[1], labelFrame: RECORD_ROOM_PICK_LABEL_FRAMES[1] },
          ]}
          onToggle={() => setPick((held) => (held === RECORD_ROOM_PICK.개인기록 ? RECORD_ROOM_PICK.순위기록 : RECORD_ROOM_PICK.개인기록))}
          onConfirm={() => onChoose(pick)}
          onCancel={onCancel}
          onClosed={onClosed}
        />
      </div>
    </ScreenOverlay>
  )
}
