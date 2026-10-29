import { useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import { TRAINING_SLOTS, checkSeasonTraining } from '@/widgets/season/lib/seasonTraining'
import type { TrainingSlot } from '@/widgets/season/lib/seasonTraining'
import { SEASON_SUB_COMMAND_SLOTS, seasonParentSlotOf } from '@/pages/season/lib/seasonCommandBar'
import { SeasonCommonFrame } from '@/pages/season/ui/SeasonCommonFrame'
import { SeasonTrainingPopup } from '@/pages/season/ui/SeasonTrainingPopup'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'
import type { SeasonTrainingResult } from '@/widgets/season/lib/seasonTrainingResult'
import { trainingPopupOf } from '@/pages/season/ui/seasonTrainingScreen/trainingPopup'
import type { TrainingPopup } from '@/pages/season/ui/seasonTrainingScreen/trainingPopup'
import { SeasonTrainingResultPopup } from '@/pages/season/ui/seasonTrainingScreen/SeasonTrainingResultPopup'

export interface SeasonTrainingScreenProps {
  readonly state: SeasonState
  /**
   * 저장+0x64 **G 포인트**. 시즌 레코드(SR)가 아니라 전역 저장 칸이라 `SeasonState` 에 없다 —
   * 지옥훈련 가드(StrMODE[65])와 값 표시에만 쓴다. 저장 쪽 모델이 생기면 그것을 넘기면 된다.
   */
  readonly gamePoints: number
  /**
   * 칸을 골라 확인까지 마쳤다.
   *
   * 원본은 확인 뒤 **연출 0xde**(훈련 팝업 0x848d0 — `SeasonTrainingPopup`)를 돌고, 애니가 끝나면 굴림 `0xc074` →
   * 적용 `0xa2f24` → 결과 팝업(0x741a0 — `result`) → 관리 메뉴 0xc9 로 돌아온다. 이 화면은 연출이 끝난 때 부른다 — 굴림은
   * 표(`widgets/season/lib/seasonTraining.ts`)를 보고 부르는 쪽이 한다.
   */
  readonly onTrain: (slot: TrainingSlot, index: number) => void
  /** 취소(−16) — 관리 메뉴(0xc9)로 되돌아간다 */
  readonly onBack: () => void
  /** 굴림 뒤 결과 팝업 (0xc074 → 0x741a0) — null 이면 없음 */
  readonly result?: SeasonTrainingResult | null
  /** 결과 팝업 키 0xf2c8 의 확인 · 취소 — 닫고 0xc9 */
  readonly onCloseResult?: () => void
  /**
   * 글 상자 첫 줄 [창+0x2d8] — 시즌 장면 창([장면+0xc0])의 칸이라 팝업을 닫았다 열어도 남는다(아래 주석).
   * 주면 부르는 쪽이 들고(`onResultFirstLineChange` 로 바꾼다), 안 주면 이 화면이 0 에서 들고 있다.
   */
  readonly resultFirstLine?: number
  readonly onResultFirstLineChange?: (line: number) => void
}

/**
 * 시즌 팀 트레이닝 화면 (장면 0x105 상태 **0xcf**, 갱신 0x4740 · 키 **0x9108** · 그리기 0xa0e4).
 *
 * 칸 0~3 = 팀 능력치 투구·타격·집중·근성(팀 레코드 +4..+0xa), 칸 4 = **지옥훈련 500G**
 * (J 4-6 확정). 가드 순서·값은 `widgets/season/lib/seasonTraining.ts` 가 가진다.
 *
 * 그리기 0xa0e4 = 공통 틀(`SeasonCommonFrame` — 커맨드 줄 하위 칸 표 0xd47c0 · 0xd47ca: 254 투구훈련 · 119 타격훈련 ·
 * 286 집중훈련 · 287 근성훈련 · 121 지옥훈련, 부모 칸 트레이닝) — 상태 0xde 일 때만 가운데 판 대신 0x848d0 을 덧그린다.
 * 칸 옆 값(능력치·500G)은 원본이 그리지 않는다.
 *
 * SR+4(행동함)는 트레이닝 적용 `0xa2f24` 끝(a3000~a3006 `strb #1, [SR, #4]`, 이어 저장)이 세운다 — 외출 0xc81c 와
 * 같다(직접 떴다). 이 화면은 손대지 않고 부르는 쪽(`useSeasonSession.runTraining`)이 세운다.
 */
export function SeasonTrainingScreen({
  state,
  gamePoints,
  onTrain,
  onBack,
  result = null,
  onCloseResult,
  resultFirstLine,
  onResultFirstLineChange,
}: SeasonTrainingScreenProps) {
  const [ownFirstLine, setOwnFirstLine] = useState(0)
  const firstLine = resultFirstLine ?? ownFirstLine
  const setFirstLine = onResultFirstLineChange ?? setOwnFirstLine
  const { record, teamMorale, teamAbilities } = state
  const abilities = teamAbilities[record.teamId] ?? []
  const [popup, setPopup] = useState<TrainingPopup | null>(null)
  /** 상태 0xde — 확인한 칸의 훈련 팝업이 돈다 */
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)

  const select = (index: number) => {
    setPopup(trainingPopupOf(checkSeasonTraining({ abilities, teamMorale, gamePoints }, index), index, abilities))
  }

  const { cursor, moveTo } = useSeasonCursor({
    count: TRAINING_SLOTS.length,
    // 5열 × 1줄 (0x3b14 의 [this+0x84] vt+0x1c(5, 1, 1, 0x330), 0x3c00~0x3c16) — ← → 도 칸을 옮긴다
    isCommandBar: true,
    onSelect: select,
    onCancel: onBack,
    isEnabled: popup === null && playingIndex === null,
  })

  return (
    <RawScreen>
      <div role="group" aria-label="트레이닝">
        <SeasonCommonFrame
          record={record}
          teamMorale={teamMorale}
          gamePoint={gamePoints}
          onBack={playingIndex === null ? onBack : null}
          // 0xde 는 공통 틀에서 가운데 판을 빼고 0x848d0 을 덧그린다
          showsCenterStage={playingIndex === null}
          // 결과 팝업이 떠 있는 동안도 상태는 0xde — 끝난 연출 위에 팝업이 뜬다
          overlay={
            playingIndex === null ? undefined : (
              <SeasonTrainingPopup
                slot={playingIndex}
                teamIndex={record.teamId}
                onFinished={() => onTrain(TRAINING_SLOTS[playingIndex], playingIndex)}
              />
            )
          }
          commandBar={{
            slots: SEASON_SUB_COMMAND_SLOTS.트레이닝,
            cursor,
            parent: seasonParentSlotOf('트레이닝'),
            onHover: moveTo,
            onSelect: (id) => select(TRAINING_SLOTS.findIndex((label) => label === id)),
          }}
        />
      </div>

      {result !== null && (
        <SeasonTrainingResultPopup result={result} onClose={() => onCloseResult?.()} firstLine={firstLine} onFirstLineChange={setFirstLine} />
      )}

      {popup !== null && (
        <MessageBox
          text={popup.text}
          buttons={popup.asks ? ['예', '아니오'] : ['확인']}
          onAnswer={(answer) => {
            const trainIndex = popup.trainIndex
            setPopup(null)
            // 팝업 0x11 · 0x12 에 예 → 상태 0xde(0x7570) — 굴림은 연출이 끝난 뒤(0xc384 → 0xc074)
            if (popup.asks && answer === 0 && trainIndex !== null) setPlayingIndex(trainIndex)
          }}
        />
      )}
    </RawScreen>
  )
}
