import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { SpecialTrainingFigure } from '@/widgets/special-swing/ui/SpecialTrainingFigure'

/**
 * 트레이닝 → [마구] — 원본 상태 **108** 의 탭 1(진입 0x17730 · 키 0x17828 · 그리기 0x19e44 → 관리 화면 0x19da4 위에 창 0x803d4).
 * 107 칸 4 의 팝업 0x78 에서 마구를 고르면(현재 상태 107) 이 창을 거쳐 칸을 고른다 — 칸 가드 · [66] 질문은
 * `usePitcherManagementMenu` 의 `confirmMagicTrainingCell` 이 본다. 취소는 107.
 *
 * 그림은 타자 필살타법 창과 같은 0x803d4 탭 0 · 1 갈래다(`SpecialTrainingFigure` — 제목 img_text 114 "마구훈련" · 아이콘 19 ·
 * 이름 StrCOMMON[0x1e + 번호] · 사용 횟수 0xd4708). 웹 단추 대신 칸 자리에 투명 누름 칸을 둔다.
 */
interface PitcherMagicTrainingPanelProps {
  readonly career: PitcherCareer
  /** 탭 격자 커서 — 진입 0x17730 이 `min(L, 3)` 에 둔다 */
  readonly cursor: number
  readonly onMoveCursor: (cell: number) => void
  readonly onConfirm: (cell: number) => void
}

export function PitcherMagicTrainingPanel({ career, cursor, onMoveCursor, onConfirm }: PitcherMagicTrainingPanelProps) {
  return (
    <div data-testid="마구훈련-창">
      <SpecialTrainingFigure side="투수" state="훈련" cursor={cursor} learnedCount={career.magicLevel}
        sessions={career.magicSessions} inUseNumber={career.selectedMagicNumber} typeIndex={career.typeIndex}
        onPressSlot={(slot) => {
          onMoveCursor(slot)
          onConfirm(slot)
        }} />
    </div>
  )
}
