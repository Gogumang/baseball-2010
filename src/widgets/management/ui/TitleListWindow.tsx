import { useEffect, useState } from 'react'
import { MessageBox } from '@/shared/ui'
import {
  currentTitleOf, equipTitleNoticeOf, titleListOf, TITLE_ROWS_PER_PAGE,
} from '@/entities/career/model/titles'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { ROW, ROW_TOP, TITLE_HEADER, TITLE_LIST_WINDOW } from '@/widgets/management/lib/titleListLayout'
import * as styles from '@/shared/ui/GameWindow/GameWindow.css'
import * as local from '@/widgets/management/ui/TitleListWindow.css'

interface TitleListWindowProps {
  readonly career: PlayerCareer
  /** 확인 키로 칭호를 바꿨다 — 세션이 `equipTitle` 로 선수 +0x1c4 를 쓰고 저장한다 */
  readonly onEquip: (title: string) => void
  readonly onClose: () => void
}

/**
 * 칭호(닉네임) 목록 — 나만의리그 관리 장면 **하위 상태 129** (P3 10-1 확정).
 *
 *   목록 0x104cc — 얻은 칭호를 **번호 오름차순**으로 (얻은 순서가 아니다). 한 화면 `min(개수, 9)` 줄.
 *   그리기 0x198fc — 이름 StrNICKNAME[i], **지금 장착한 것**(선수+0x1c4 == 목록값)만 다른 색.
 *   키 0x11f78 — 확인(−5/'5') 이면 +0x1c4 = sel 로 장착하고 팝업(이름 + StrMODE[138]) 뒤 저장.
 *                '*'(−16/0x2a) 면 하위 상태 0x77 = **119**(기본정보) 로 돌아간다.
 *
 * ⚠️ 창 좌표는 `titleListLayout.ts` 에 적은 대로 **근사**다.
 */
export function TitleListWindow({ career, onEquip, onClose }: TitleListWindowProps) {
  const titles = titleListOf(career.titleIds)
  const equipped = currentTitleOf(career)
  const [cursor, setCursor] = useState(() => Math.max(titles.indexOf(equipped), 0))
  const [notice, setNotice] = useState<string | null>(null)

  /** 커서가 있는 쪽의 첫 줄 — 원본 목록 객체가 쪽 단위로 굴린다 (`sel = list[쪽·쪽당 + 커서]`) */
  const pageTop = Math.floor(cursor / TITLE_ROWS_PER_PAGE) * TITLE_ROWS_PER_PAGE
  const page = titles.slice(pageTop, pageTop + TITLE_ROWS_PER_PAGE)

  /** 확인 키 — 이미 장착한 것이면 원본도 **아무 일도 하지 않는다** (0x11fd6 의 `!=` 검사) */
  const confirm = (index: number) => {
    const picked = titles[index]
    if (picked === undefined || picked === equipped) return
    onEquip(picked)
    setNotice(equipTitleNoticeOf(picked))
  }

  useEffect(() => {
    // 팝업이 떠 있으면 MessageBox 가 먼저 키를 가져간다
    if (notice !== null) return
    const onKey = (event: KeyboardEvent) => {
      const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
      if (step !== 0) {
        event.preventDefault()
        if (titles.length === 0) return
        return setCursor((current) => (current + step + titles.length) % titles.length)
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        confirm(cursor)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className={styles.overlay} role="dialog" aria-label="칭호" onClick={onClose}>
      <div className={styles.window}
        style={{ left: TITLE_LIST_WINDOW.x, top: TITLE_LIST_WINDOW.y, width: TITLE_LIST_WINDOW.width, height: TITLE_LIST_WINDOW.height }} />
      <div className={local.header}
        style={{ left: TITLE_HEADER.x, top: TITLE_HEADER.y, width: TITLE_HEADER.width, height: TITLE_HEADER.height }}>
        칭호
      </div>

      {/*
        목록이 비면 줄이 하나도 없다 — 원본도 개수 0 이면 아무것도 그리지 않는다.
        0번 "이름 없는 신인" 을 첫 관리 화면에서 얻으니 실제로 빈 목록을 볼 일은 거의 없다.
      */}
      {page.map((title, row) => {
        const index = pageTop + row
        return (
          <button key={title} type="button"
            aria-current={title === equipped ? 'true' : undefined}
            className={[local.row, title === equipped ? local.equippedRow : '', index === cursor ? local.cursorRow : '']
              .filter((name) => name !== '')
              .join(' ')}
            style={{ left: ROW.x, top: ROW_TOP + ROW.height * row, width: ROW.width, height: ROW.height }}
            onMouseEnter={() => setCursor(index)}
            onClick={(event) => { event.stopPropagation(); setCursor(index); confirm(index) }}>
            {title}
          </button>
        )
      })}

      {notice !== null && (
        <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />
      )}
    </div>
  )
}
