import { useEffect, useEffectEvent, useState } from 'react'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCH_WINDOW_TABS } from '@/pages/pitcher-league/lib/pitcherManagementMenu'
import { PITCH_TRAINING_START, pitchTrainingKeyOf, pitchTrainingKeyOutcomeOf } from '@/pages/pitcher-league/lib/pitchTrainingWindow'
import type { PitchTrainingCursor } from '@/pages/pitcher-league/lib/pitchTrainingWindow'
import { moveSpecialTrainingCursor, specialTrainingKeyOf } from '@/widgets/special-swing/lib/specialTrainingWindow'
import { SpecialTrainingFigure } from '@/widgets/special-swing/ui/SpecialTrainingFigure'
import { PitchWindowFigure } from '@/pages/pitcher-league/ui/PitchWindowFigure'

/**
 * 선수정보 → [구질] 이 여는 창 — 원본 상태 **123**(진입 0x17690 · 키 0x17cec · 그리기 0x19e24). 모두 직접 떴다.
 *
 * 그리기 0x19e24 = 관리 화면 0x19da4 → 창 0x803d4(gfx, 상태 틱) — 108 그리기 0x19e44 와 **같은 창**이고 상태 0x7b 만 다르다.
 * 탭 `[gfx+0x188]` 은 106 칸 3 의 팝업 0x78 이 고른 값(1 마구 · 2 구질) 그대로다 — 창 안에서 탭을 바꾸는 길은 없다.
 * - 탭 1: 필살타법 · 마구 창 그림(`SpecialTrainingFigure` 투수 · '사용') — G 동전 · 비용 · 횟수 없음, 아래 글 "장착"/"사용중".
 * - 탭 2: 구질 창 그림(`PitchWindowFigure` '장착') — 아래 글은 처음 0x127 "장착", 목록에 든 구질이면 0x128 "사용중".
 *
 * 진입 0x17690 은 0x80235 로 두 격자를 (0, 0) · 초점 `[gfx+0x18c]` = 0 으로 되감고 slt_pitch 를 싣는다 — 처음 커서는 칸 0 · 탭 줄 0.
 *
 * 키 0x17cec:
 * ```
 * OK(−5 · '5')  탭 ≤ 1: 칸 c = 탭 격자 — 0xa43c4 면 [69] · L ≤ c 면 [71] · 그 밖 [70] "[이름] 을 사용하시겠습니까?" (예/아니오)
 *               탭 2:   초점 0 이면 초점 = 1(17e04) · 1 이면 (행 = 탭 격자, 열 = min(칸, 4)) — 0xa436c 면 [72] ·
 *                       덜 배웠으면 [71] · 그 밖 [73] (예/아니오) — 가드는 `usePitcherManagementMenu` 의 `selectMagicCell` · `selectPitchCell`
 * CLR(−16)      탭 2 이고 초점 ≠ 0 이면 초점 = 0(17efe) · 아니면 0xbcb49(0x6a) = 106
 * 그 밖         창 키 0x80269 — 108 과 같은 격자 키
 * ```
 * 웹 단추 대신 원본 칸 자리에 투명 누름 칸(`PressArea`)을 둔다. 알림 · 질문 상자는 화면(`PitcherManagementScreen`)이 띄운다.
 */

interface PitcherRepertoirePanelProps {
  readonly career: PitcherCareer
  /** 팝업 0x78 이 고른 탭 (1 마구 · 2 구질) */
  readonly tab: number
  /** 키를 받는가 — 알림 · 질문 상자가 떠 있으면 상자가 키를 가져간다 */
  readonly isKeyEnabled: boolean
  /** 마구 칸 i(0~3)를 고른다 — 막히면 화면이 StrMODE 글만 띄운다 */
  readonly onSelectMagic: (cellIndex: number) => void
  /** 구질 칸(행, 열)을 고른다 */
  readonly onSelectPitch: (row: number, column: number) => void
  /** 취소 → 106 (0x17cec 17f04 `0xbcb49(0x6a)`) */
  readonly onClose: () => void
}

export function PitcherRepertoirePanel({ career, tab, isKeyEnabled, onSelectMagic, onSelectPitch, onClose }: PitcherRepertoirePanelProps) {
  const isMagic = tab !== PITCH_WINDOW_TABS.구질
  /** 탭 1 — 탭 격자 [gfx+0x190] 칸 0~3 */
  const [magicCursor, setMagicCursor] = useState(0)
  /** 탭 2 — 탭 격자(행) · 칸 격자 · 초점 */
  const [pitchCursor, setPitchCursor] = useState<PitchTrainingCursor>(PITCH_TRAINING_START)

  const latest = useEffectEvent(() => ({ isMagic, magicCursor, pitchCursor, onSelectMagic, onSelectPitch, onClose }))
  useEffect(() => {
    if (!isKeyEnabled) return undefined
    const onKey = (event: KeyboardEvent) => {
      const held = latest()
      if (held.isMagic) {
        const key = specialTrainingKeyOf(event.key)
        if (key === null) return
        event.preventDefault()
        if (key === 'ok') return held.onSelectMagic(held.magicCursor)
        if (key === 'clr') return held.onClose()
        return setMagicCursor((current) => moveSpecialTrainingCursor(current, key))
      }
      const key = pitchTrainingKeyOf(event.key)
      if (key === null) return
      event.preventDefault()
      const outcome = pitchTrainingKeyOutcomeOf(held.pitchCursor, key)
      if (outcome.kind === 'close') return held.onClose()
      if (outcome.kind === 'confirm') return held.onSelectPitch(outcome.row, outcome.column)
      setPitchCursor(outcome.cursor)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isKeyEnabled])

  return (
    <div data-testid="구질목록-창" data-tab={tab}>
      {isMagic ? (
        <SpecialTrainingFigure
          side="투수"
          state="사용"
          cursor={magicCursor}
          learnedCount={career.magicLevel}
          sessions={career.magicSessions}
          inUseNumber={career.selectedMagicNumber}
          typeIndex={career.typeIndex}
          onPressSlot={(slot) => {
            setMagicCursor(slot)
            onSelectMagic(slot)
          }}
        />
      ) : (
        <PitchWindowFigure
          career={career}
          cursor={pitchCursor}
          state="장착"
          onPressTab={(row) => setPitchCursor({ ...pitchCursor, tab: row, isCellFocus: false })}
          onPressCell={(cellColumn) => {
            setPitchCursor({ ...pitchCursor, isCellFocus: true, cell: cellColumn })
            onSelectPitch(pitchCursor.tab, cellColumn)
          }}
        />
      )}
    </div>
  )
}
