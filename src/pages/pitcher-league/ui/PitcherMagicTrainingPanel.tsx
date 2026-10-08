import { Hint, Panel } from '@/shared/ui'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherFormOfCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { magicPitchNameOf } from '@/entities/pitcher-career/model/magicPitch'
import { MAGIC_PITCH_CELL_NUMBERS } from '@/entities/pitcher-career/model/pitchSelection'
import * as styles from '@/pages/pitcher-league/ui/PitcherManagementScreen.css'

/**
 * 트레이닝 → [마구] — 원본 상태 **108** 의 탭 1(진입 0x17730 · 키 0x17828 · 그리기 0x19e44 → 0x803d4).
 * 107 칸 4 의 팝업 0x78 에서 마구를 고르면(현재 상태 107) 이 창을 거쳐 칸을 고른다 — 칸 가드 · [66] 질문은
 * `usePitcherManagementMenu` 의 `confirmMagicTrainingCell` 이 본다. 취소는 107.
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 0x803d4 의 탭 1 그림(칸 그림 · 이름 · 설명 · 훈련 횟수)은 옮기지 않았다. 투수편 하위 창 관례대로
 * 칸 넷을 줄 버튼으로 세우고 커서 칸을 눌러 그린다(123 `PitcherRepertoirePanel` 과 같은 판).
 */
interface PitcherMagicTrainingPanelProps {
  readonly career: PitcherCareer
  /** 격자 커서 — 진입 0x17730 이 `min(L, 3)` 에 둔다 */
  readonly cursor: number
  readonly onMoveCursor: (cell: number) => void
  readonly onConfirm: (cell: number) => void
}

export function PitcherMagicTrainingPanel({ career, cursor, onMoveCursor, onConfirm }: PitcherMagicTrainingPanelProps) {
  const form = pitcherFormOfCareer(career)
  return (
    <Panel heading="마구 훈련">
      <div className={styles.pitchList}>
        {MAGIC_PITCH_CELL_NUMBERS.map((number, cell) => {
          const isCursor = cell === cursor
          // 배운 칸(L > i)과 아직 못 여는 칸을 가른다 — 그림의 잠김 표시 자리(근사)
          const isLocked = career.magicLevel < cell
          return (
            <button key={number} type="button" aria-pressed={isCursor}
              className={`${styles.pitchChip} ${isCursor ? styles.pitchChipSelected : ''} ${isLocked ? styles.pitchChipLocked : ''}`}
              onPointerEnter={() => onMoveCursor(cell)}
              onClick={() => {
                onMoveCursor(cell)
                onConfirm(cell)
              }}>
              {magicPitchNameOf(number, form) ?? ''}
            </button>
          )
        })}
      </div>
      <Hint>배운 수 {career.magicLevel}/{MAGIC_PITCH_CELL_NUMBERS.length} — 배울 수 있는 칸은 배운 수 칸 하나뿐이다 (저장 +0x201)</Hint>
    </Panel>
  )
}
