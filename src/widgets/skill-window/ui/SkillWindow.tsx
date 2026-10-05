import { useEffect, useState } from 'react'
import { MessageBox } from '@/shared/ui'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { isSkillEquipped, PLUS_SKILL_SLOT_LIMITS, plusSkillSlotLimitOf } from '@/entities/career/model/playerCareer'
import { expandSkillSlots, skillConfirmKindOf, skillSlotExpansionCostOf } from '@/entities/career/model/skillEquip'
import {
  SKILL_HEADER, SKILL_ROW, SKILL_ROW_TOP, SKILL_ROWS_PER_PAGE, SKILL_WINDOW,
} from '@/widgets/skill-window/lib/skillWindowLayout'
import * as styles from '@/shared/ui/GameWindow/GameWindow.css'
import * as local from '@/widgets/skill-window/ui/SkillWindow.css'

/** 이 창이 쓰는 StrMODE 번호 (`modeText.json` 과 번호가 같다) */
const TEXT = {
  G포인트부족: 65,
  해제불가: 129,
  사용확인: 130,
  해제확인: 131,
  최대: 132,
  확장앞: 133,
  확장뒤: 134,
  확장됨: 136,
} as const
const textOf = (index: number) => ORIGINAL_MODE_TEXT[index] ?? ''
const nameOf = (skillId: number) => ORIGINAL_SKILLS[skillId]?.name ?? ''

interface SkillWindowProps {
  readonly career: PlayerCareer
  /** 대화 번호 4(장착)·3(해제) 의 "예" — 0x1483c `0xa4b04(P, s, on)` */
  readonly onEquip: (skillId: number, on: boolean) => void
  /** 대화 번호 6(확장) 의 "예" — 0x1484c. G 가 넉넉할 때만 부른다 */
  readonly onExpandSlots: () => void
  readonly onClose: () => void
}

type Prompt =
  | { readonly kind: '질문'; readonly text: string; readonly onYes: () => void }
  | { readonly kind: '알림'; readonly text: string }

/**
 * 스킬 창 — 선수정보 칸 "아이템/스킬"(하위 상태 122). **키 처리·대화는 확정, 배치는 미해결.**
 *
 * 확인 키 0x13140 (H-modes 6절, 확정) — 문구는 버퍼 `"!C"`(0xcc210) 에 이어 붙인다:
 *   마이너스      → `!C[` + 이름 + StrMODE[129]                       알림 (1,1)
 *   장착 중       → `!C[` + 이름 + StrMODE[131]                       예/아니오 (2,3) → 해제
 *   자리 있음     → `!C[` + 이름 + StrMODE[130]                       예/아니오 (2,4) → 장착
 *   가득 · L ≤ 1  → `!C` + 비용 + [133] + " " + 0xcc4f4[L+1] + " " + [134]  예/아니오 (2,6) → 확장
 *   가득 · L = 2  → `!C` + sprintf([132], 0xcc4f4[L])                 알림 (1,5)
 * 확장 "예"(0x1484c): G 부족이면 StrMODE[65](2,2), 아니면 확장 뒤 sprintf([136], 새 상한) (1,1).
 *
 * ⚠️ 미해결 — 원본 목록 객체 0x85ad0 이 무엇을 어떤 차례로 담는지(아이템 칸도 같은 창인지 포함),
 *    창 그리기 0x81dc0 의 좌표·색을 못 읽었다. 웹은 **보유 스킬을 얻은 차례대로** 한 줄씩 늘어놓고
 *    장착한 줄만 색을 바꾼다(근사). 아이템 쪽은 아직 없다.
 * ⚠️ G 부족 [65] 의 "예"(0xbcb49(장면, 0x8b) — 구매 화면으로 보임)는 웹에 갈 곳이 없어 닫기만 한다.
 */
export function SkillWindow({ career, onEquip, onExpandSlots, onClose }: SkillWindowProps) {
  const skills = career.skillIds
  const [cursor, setCursor] = useState(0)
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const pageTop = Math.floor(cursor / SKILL_ROWS_PER_PAGE) * SKILL_ROWS_PER_PAGE
  const page = skills.slice(pageTop, pageTop + SKILL_ROWS_PER_PAGE)

  const ask = (text: string, onYes: () => void) => setPrompt({ kind: '질문', text, onYes })
  const tell = (text: string) => setPrompt({ kind: '알림', text })

  /** 대화 번호 6 의 "예" — 0x1484c */
  const expand = () => {
    const result = expandSkillSlots(career)
    if (result.kind === 'G포인트부족') return ask(textOf(TEXT.G포인트부족), () => {})
    onExpandSlots()
    tell(textOf(TEXT.확장됨).replace('%d', String(result.slots)))
  }

  /** 확인 키 — 0x13140 */
  const confirm = (index: number) => {
    const skillId = skills[index]
    if (skillId === undefined) return // 빈 칸(s = −1)은 아무 일도 없다 (0x1327e)
    const name = nameOf(skillId)
    switch (skillConfirmKindOf(career, skillId)) {
      case '해제불가':
        return tell(`!C[${name}${textOf(TEXT.해제불가)}`)
      case '해제확인':
        return ask(`!C[${name}${textOf(TEXT.해제확인)}`, () => onEquip(skillId, false))
      case '장착확인':
        return ask(`!C[${name}${textOf(TEXT.사용확인)}`, () => onEquip(skillId, true))
      case '확장확인': {
        const nextLimit = PLUS_SKILL_SLOT_LIMITS[career.skillSlotLevel + 1]
        return ask(`!C${skillSlotExpansionCostOf(career)}${textOf(TEXT.확장앞)} ${nextLimit} ${textOf(TEXT.확장뒤)}`, expand)
      }
      case '최대':
        return tell(`!C${textOf(TEXT.최대).replace('%d', String(plusSkillSlotLimitOf(career)))}`)
    }
  }

  useEffect(() => {
    // 대화가 떠 있으면 MessageBox 가 먼저 키를 가져간다
    if (prompt !== null) return
    const onKey = (event: KeyboardEvent) => {
      const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
      if (step !== 0) {
        event.preventDefault()
        if (skills.length === 0) return
        return setCursor((current) => (current + step + skills.length) % skills.length)
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
    <div className={styles.overlay} role="dialog" aria-label="아이템/스킬" onClick={onClose}>
      <div className={styles.window}
        style={{ left: SKILL_WINDOW.x, top: SKILL_WINDOW.y, width: SKILL_WINDOW.width, height: SKILL_WINDOW.height }} />
      <div className={local.header}
        style={{ left: SKILL_HEADER.x, top: SKILL_HEADER.y, width: SKILL_HEADER.width, height: SKILL_HEADER.height }}>
        스킬
      </div>
      {page.map((skillId, row) => {
        const index = pageTop + row
        const isEquipped = isSkillEquipped(career, skillId)
        return (
          <button key={skillId} type="button"
            aria-pressed={isEquipped}
            className={[local.row, isEquipped ? local.equippedRow : '', index === cursor ? local.cursorRow : '']
              .filter((name) => name !== '')
              .join(' ')}
            style={{ left: SKILL_ROW.x, top: SKILL_ROW_TOP + SKILL_ROW.height * row, width: SKILL_ROW.width, height: SKILL_ROW.height }}
            onMouseEnter={() => setCursor(index)}
            onClick={(event) => { event.stopPropagation(); setCursor(index); confirm(index) }}>
            {nameOf(skillId)}
          </button>
        )
      })}

      {/* 대화의 단추 클릭이 창 바깥 클릭(닫기)으로 번지지 않게 막는다 — 대화 뒤 창이 남는다(원본의 복귀 상태는 미확인) */}
      <div onClick={(event) => event.stopPropagation()}>
      {prompt?.kind === '질문' && (
        <MessageBox text={prompt.text} buttons={['예', '아니오']}
          onAnswer={(answer) => { const pending = prompt; setPrompt(null); if (answer === 0) pending.onYes() }} />
      )}
      {prompt?.kind === '알림' && (
        <MessageBox text={prompt.text} buttons={['확인']} onAnswer={() => setPrompt(null)} />
      )}
      </div>
    </div>
  )
}
