import { useState } from 'react'
import { Hint, MessageBox, Notice, Panel, PixelScreen } from '@/shared/ui'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  HIDDEN_PITCH_COLUMN,
  PITCH_TRAINING_COLUMN_COUNT,
  PITCH_TRAINING_TABLE,
  PITCH_TRAINING_TEXT,
  hasPitchType,
  pitchTrainingCostOf,
  pitchTrainingGateOf,
  pitchTypeNameOf,
  pitchTypeNumberOf,
  trainPitchType,
} from '@/entities/pitcher-career/model/pitchTraining'
import * as styles from '@/pages/pitcher-league/ui/PitchTrainingScreen.css'

/**
 * **구질 훈련 창** — 투수편 관리 화면의 훈련 칸 4 가 여는 상태 **0x78** 이다
 * (타자편은 필살타법 창 0x6c — 0x12dc0, R7 4절 149행). 표와 가드는 J 3-2 확정이다.
 *
 * 칸을 고르면 원본 가드 순서를 그대로 탄다: 이미 가진 구질·단계 초과는 **아무 말 없이 무시**,
 * 히든 미오픈 StrMODE[67] · 선행 미완 [68] · G 부족 [65] · 그 밖은 [66] 확인 상자.
 *
 * ⚠️ 훈련 **횟수**(StrMODE[89] "해당 구질 %d/%d회 훈련") 표는 해독 문서에 없다 (J 3-2 미해결) —
 * 한 번에 배우는 것으로 둔다.
 */

interface PitchTrainingScreenProps {
  readonly career: PitcherCareer
  /** 배운 뒤의 커리어를 돌려준다 */
  readonly onTrained: (career: PitcherCareer) => void
  readonly onClose: () => void
}

/** StrMODE 글 — 표에 없는 번호는 원문을 못 읽어 뜻만 옮겼다 */
const BLOCK_TEXT: Readonly<Record<number, string>> = {
  [PITCH_TRAINING_TEXT.hiddenLocked]: '아직 배울 수 없는 구질입니다',
  [PITCH_TRAINING_TEXT.prerequisite]: '선행 구질 훈련 완료 후 배울 수 있습니다',
  [PITCH_TRAINING_TEXT.notEnoughPoints]: 'G포인트가 부족합니다',
}

export function PitchTrainingScreen({ career, onTrained, onClose }: PitchTrainingScreenProps) {
  const [notice, setNotice] = useState('')
  const [asking, setAsking] = useState<{ row: number; column: number; cost: number } | null>(null)

  const select = (row: number, column: number) => {
    const gate = pitchTrainingGateOf(career, row, column)
    setNotice('')
    if (gate.kind === '무시') return
    if (gate.kind === '막힘') return setNotice(BLOCK_TEXT[gate.textIndex] ?? '')
    setAsking({ row, column, cost: gate.cost })
  }

  return (
    <PixelScreen
      title="구질 훈련"
      badge={`${career.gamePoint} G`}
      leftKey={{ label: '되돌아가기', onPress: onClose }}
    >
      <Panel heading="구질">
        <div className={styles.grid}>
          {PITCH_TRAINING_TABLE.map((row, rowIndex) =>
            row.map((typeNumber, column) => {
              const owned = hasPitchType(career, typeNumber)
              const locked =
                column === HIDDEN_PITCH_COLUMN && !career.hiddenPitchRows[rowIndex]
              return (
                <button key={typeNumber} type="button"
                  className={[styles.cell, owned ? styles.cellOwned : '', locked ? styles.cellLocked : '']
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={`${pitchTypeNameOf(typeNumber)}${owned ? ' 보유' : ''}`}
                  onClick={() => select(rowIndex, column)}>
                  {pitchTypeNameOf(typeNumber)}
                  <span className={styles.cost}>{owned ? '보유' : `${pitchTrainingCostOf(column)}G`}</span>
                </button>
              )
            }),
          )}
        </div>
        <Hint>
          열 {PITCH_TRAINING_COLUMN_COUNT} 번째는 히든 변화구다 — 이벤트로 계열이 열려야 배운다
        </Hint>
      </Panel>

      {notice !== '' && <Notice>{notice}</Notice>}

      {asking !== null && (
        <MessageBox
          /* StrMODE[66] "%d G포인트가 소모됩니다" */
          text={`!C${asking.cost} G포인트가 소모됩니다`}
          buttons={['예', '아니오']}
          onAnswer={(index) => {
            const chosen = asking
            setAsking(null)
            if (index !== 0) return
            const trained = trainPitchType(career, chosen.row, chosen.column)
            setNotice(`${pitchTypeNameOf(pitchTypeNumberOf(chosen.row, chosen.column))} 을(를) 배웠습니다`)
            onTrained(trained)
          }}
        />
      )}
    </PixelScreen>
  )
}
