import { useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import {
  HELL_TRAINING_INDEX, TRAINING_GUARD_CEILING, TRAINING_SLOTS,
  checkSeasonTraining,
} from '@/widgets/season/lib/seasonTraining'
import type { TrainingSlot } from '@/widgets/season/lib/seasonTraining'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { fillModeText } from '@/widgets/season/lib/seasonText'
import { SEASON_SUB_COMMAND_SLOTS, seasonParentSlotOf } from '@/pages/season/lib/seasonCommandBar'
import { SeasonCommonFrame } from '@/pages/season/ui/SeasonCommonFrame'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'

/** StrMODE 번호 (가드 0x9108 이 0x702b4 로 꺼내는 글 — 직접 떴다) */
const TEXT = {
  /** "!C사기가 0일 때는!N훈련을 할 수 없습니다" — 팝업 (1,1) */
  사기없음: 193,
  /** "G포인트가 부족합니다. 구매 페이지로 이동하시겠습니까?" — 팝업 (2,2) 예/아니오 */
  G부족: 65,
  /** "[%s] 능력치가 최대입니다" — %s = StrMODE[44 + 칸] */
  능력치최대: 192,
  /** "[지옥훈련]을 하시겠습니까? … 500 G포인트가 소모됩니다" — 팝업 (2, 0x12) */
  지옥훈련확인: 141,
  /** "[%s훈련]을 하시겠습니까?" — %s = StrMODE[44 + 칸], 팝업 (2, 0x11) */
  훈련확인: 85,
  /** StrMODE[44..47] 투구·타격·집중·근성 */
  능력치이름: 44,
} as const

/** StrMODE[192] 를 칸 이름으로 채운 한 줄 (sprintf(buf, [192], [44 + 칸])) */
const maxedLineOf = (index: number): string =>
  fillModeText(ORIGINAL_MODE_TEXT[TEXT.능력치최대] ?? '', ORIGINAL_MODE_TEXT[TEXT.능력치이름 + index] ?? '')

/** 팝업 한 장 — 글과 단추 */
interface TrainingPopup {
  readonly text: string
  /** 예/아니오(2) 인가, 확인 하나(1)인가 */
  readonly asks: boolean
  /** 예를 누르면 훈련할 칸. 없으면 예도 닫기만 한다 */
  readonly trainIndex: number | null
}

/**
 * 가드 0x9108 (9128~9310, 직접 떴다) 이 띄우는 팝업:
 * ```
 * 팀 사기 == 0                     → [193]                        (1,1)
 * 칸 4 지옥훈련: G < 500           → [65]                         (2,2) — 예는 G 충전 페이지 0xfa (이식 대상 아님)
 *               능력치 > 998 인 칸마다 sprintf([192], [44+i]) + "!N" 을 이어 붙인다
 *               넷 다 최대          → 그 글                         (1,1)
 *               그 밖              → 그 글 + [141]                 (2,0x12)
 * 칸 0~3: 그 칸 > 998              → sprintf([192], [44+칸])       (1,1)
 *         그 밖                    → sprintf([85], [44+칸])        (2,0x11)
 * ```
 */
function trainingPopupOf(
  checked: ReturnType<typeof checkSeasonTraining>,
  index: number,
  abilities: readonly number[],
): TrainingPopup {
  if (!checked.ok && checked.reason === '사기없음') {
    return { text: ORIGINAL_MODE_TEXT[TEXT.사기없음] ?? '', asks: false, trainIndex: null }
  }
  if (index === HELL_TRAINING_INDEX) {
    if (!checked.ok && checked.reason === 'G부족') {
      return { text: ORIGINAL_MODE_TEXT[TEXT.G부족] ?? '', asks: true, trainIndex: null }
    }
    const maxed = abilities
      .map((value, slot) => (value > TRAINING_GUARD_CEILING ? `${maxedLineOf(slot)}!N` : ''))
      .join('')
    if (!checked.ok) return { text: maxed, asks: false, trainIndex: null }
    return { text: maxed + (ORIGINAL_MODE_TEXT[TEXT.지옥훈련확인] ?? ''), asks: true, trainIndex: index }
  }
  if (!checked.ok) return { text: maxedLineOf(index), asks: false, trainIndex: null }
  return {
    text: fillModeText(ORIGINAL_MODE_TEXT[TEXT.훈련확인] ?? '', ORIGINAL_MODE_TEXT[TEXT.능력치이름 + index] ?? ''),
    asks: true,
    trainIndex: index,
  }
}

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
   * 원본은 여기서 **연출 0xde**(훈련 애니, R13 5절)로 넘어가 애니가 끝나면 굴림 `0xc074` →
   * 적용 `0xa2f24` → 결과 팝업 0x13 → 관리 메뉴 0xc9 로 돌아온다. 굴림에는 난수가 필요해
   * 이 화면에서 하지 않는다 — 표(`widgets/season/lib/seasonTraining.ts`)를 보고 부르는 쪽이 한다.
   */
  readonly onTrain: (slot: TrainingSlot, index: number) => void
  /** 취소(−16) — 관리 메뉴(0xc9)로 되돌아간다 */
  readonly onBack: () => void
}

/**
 * 시즌 팀 트레이닝 화면 (장면 0x105 상태 **0xcf**, 갱신 0x4740 · 키 **0x9108** · 그리기 0xa0e4).
 *
 * 칸 0~3 = 팀 능력치 투구·타격·집중·근성(팀 레코드 +4..+0xa), 칸 4 = **지옥훈련 500G**
 * (J 4-6 확정). 가드 순서·값은 `widgets/season/lib/seasonTraining.ts` 가 가진다.
 *
 * 그리기 0xa0e4 = 공통 틀(`SeasonCommonFrame` — 커맨드 줄 하위 칸 표 0xd47c0 · 0xd47ca: 254 투구훈련 · 119 타격훈련 ·
 * 286 집중훈련 · 287 근성훈련 · 121 지옥훈련, 부모 칸 트레이닝) — 상태 0xde 일 때만 0x848d0 을 덧그린다.
 * 칸 옆 값(능력치·500G)은 원본이 그리지 않는다.
 *
 * ⚠️ **SR+4(행동함)를 세우는 자리는 문서에 없다**: 외출은 결과 0xc81c 끝에서 세우는 것이 확정인데
 * (P4 3절), 트레이닝 적용 `0xa2f24` 에는 그런 줄이 적혀 있지 않다. 관리 메뉴 갱신 0x4efc 가
 * SR+4 로 **트레이닝·외출 두 칸을 함께** 끄는 것을 보면 트레이닝도 세우는 것이 맞겠지만,
 * 그 자리를 확인하지 못해 이 화면은 손대지 않는다 — 부르는 쪽이 정한다.
 */
export function SeasonTrainingScreen({ state, gamePoints, onTrain, onBack }: SeasonTrainingScreenProps) {
  const { record, teamMorale, teamAbilities } = state
  const abilities = teamAbilities[record.teamId] ?? []
  const [popup, setPopup] = useState<TrainingPopup | null>(null)

  const select = (index: number) => {
    setPopup(trainingPopupOf(checkSeasonTraining({ abilities, teamMorale, gamePoints }, index), index, abilities))
  }

  const { cursor, moveTo } = useSeasonCursor({
    count: TRAINING_SLOTS.length,
    onSelect: select,
    onCancel: onBack,
    isEnabled: popup === null,
  })

  return (
    <RawScreen>
      <div role="group" aria-label="트레이닝">
        <SeasonCommonFrame record={record} teamMorale={teamMorale} gamePoint={gamePoints} onBack={onBack}
          commandBar={{
            slots: SEASON_SUB_COMMAND_SLOTS.트레이닝, cursor, parent: seasonParentSlotOf('트레이닝'),
            onHover: moveTo,
            onSelect: (id) => select(TRAINING_SLOTS.findIndex((label) => label === id)),
          }} />
      </div>

      {popup !== null && (
        <MessageBox
          text={popup.text}
          buttons={popup.asks ? ['예', '아니오'] : ['확인']}
          onAnswer={(answer) => {
            const trainIndex = popup.trainIndex
            setPopup(null)
            if (popup.asks && answer === 0 && trainIndex !== null) onTrain(TRAINING_SLOTS[trainIndex], trainIndex)
          }}
        />
      )}
    </RawScreen>
  )
}
