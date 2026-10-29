import type { RefObject } from 'react'
import { MarkupText } from '@/shared/ui'
import { nameByteLengthOf } from '@/entities/career/model/playerCareer'
import { EDITED_NAME_BYTES } from '@/entities/player-name/model/editedNames'
import * as styles from '@/pages/special-edit/ui/SpecialEditScreen.css'
import { FIELD, INPUT_MODE_ARROWS, INPUT_MODE_MARK, NAME_PROMPT, PROMPT } from '@/pages/special-edit/ui/specialEdit/editNamePopupLayout'

interface EditNameFieldsProps {
  readonly name: string
  /** 펼치는 동안 — 글 · 칸은 숨기고 칸은 읽기만 */
  readonly isOpening: boolean
  readonly fieldRef: RefObject<HTMLInputElement | null>
  readonly onName: (name: string) => void
}

/** 창 안 — 문구 · 입력 방식 ◀ ▶ "가" · 입력 칸 (그리기 콜백 0x32b7d) */
export function EditNameFields({ name, isOpening, fieldRef, onName }: EditNameFieldsProps) {
  const visibility = isOpening ? 'hidden' : undefined
  return (
    <>
      <div className={styles.prompt} style={{ left: PROMPT.x, top: PROMPT.y, width: PROMPT.width, visibility }}>
        <MarkupText raw={NAME_PROMPT} />
      </div>
      <img
        alt=""
        data-testid="입력방식-왼쪽"
        src={INPUT_MODE_ARROWS.image}
        style={{ position: 'absolute', left: INPUT_MODE_ARROWS.leftX, top: INPUT_MODE_ARROWS.y, visibility }}
      />
      <img
        alt=""
        data-testid="입력방식-오른쪽"
        src={INPUT_MODE_ARROWS.image}
        style={{ position: 'absolute', left: INPUT_MODE_ARROWS.rightX, top: INPUT_MODE_ARROWS.y, transform: 'scaleX(-1)', visibility }}
      />
      <div className={styles.prompt} data-testid="입력방식" style={{ left: INPUT_MODE_MARK.x, top: INPUT_MODE_MARK.y, visibility }}>
        <MarkupText raw={`!cFFFFFF${INPUT_MODE_MARK.label}`} />
      </div>
      <input
        ref={fieldRef}
        className={styles.field}
        aria-label="이름"
        value={name}
        autoFocus
        readOnly={isOpening}
        style={{ left: FIELD.x, top: FIELD.y, width: FIELD.width, height: FIELD.height, visibility }}
        onChange={(event) => {
          // CP949 8 바이트까지 (입력기 최대 I+8 = min(8, 64), R11 1b — 한글 2 · 그 밖 1, 섞어 써도 된다)
          if (nameByteLengthOf(event.target.value) <= EDITED_NAME_BYTES) onName(event.target.value)
        }}
      />
    </>
  )
}
