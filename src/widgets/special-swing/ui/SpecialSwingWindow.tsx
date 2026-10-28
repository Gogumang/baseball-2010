import { useEffect, useState } from 'react'
import { MessageBox } from '@/shared/ui'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { SPECIAL_SWING_REQUIRED_POPULARITY, specialSwingSlotBlockOf, specialSwingSlotCostOf } from '@/entities/career/model/training'
import { NO_SPECIAL_SWING_NUMBER, specialSwingPickOf } from '@/widgets/special-swing/lib/specialSwingSelection'
import { SPECIAL_TRAINING_SLOT_COUNT, moveSpecialTrainingCursor, specialTrainingKeyOf } from '@/widgets/special-swing/lib/specialTrainingWindow'
import { SpecialTrainingFigure } from '@/widgets/special-swing/ui/SpecialTrainingFigure'
import * as styles from '@/shared/ui/GameWindow/GameWindow.css'

/** 이 창이 쓰는 StrMODE 번호 (`modeText.json` 과 번호가 같다) */
const TEXT = {
  인기도부족: 62,
  훈련완료: 63,
  선행필요: 64,
  G포인트부족: 65,
  배우기확인: 66,
  사용중: 69,
  사용확인: 70,
  미습득: 71,
} as const
const textOf = (index: number) => ORIGINAL_MODE_TEXT[index] ?? ''

/**
 * 창이 여는 두 상태 (H-4 · R7 4절).
 *   `'사용'` — 선수정보 칸 3 → 상태 **0x7b**, 키 처리 `0x17cec`. 배운 기술 중 하나를 고른다
 *   `'훈련'` — 트레이닝 칸 4 → 상태 **0x6c**, 키 처리 `0x17828`. 다음 칸을 배운다
 */
export type SpecialSwingWindowMode = '사용' | '훈련'

interface SpecialSwingWindowProps {
  /** 배운 필살타법 수 L (저장 +0x201). 칸 i 는 `L > i` 일 때 배운 칸이다 */
  readonly level: number
  /** 이번 레벨에서 지금까지 한 훈련 횟수 */
  readonly sessions: number
  /** 선수 타입 (0 타격형 · 1 장타형) — **넷째 칸 이름이 이걸로 갈린다** */
  readonly battingTypeIndex: number
  /** 기본은 선수정보 쪽(기술 고르기)이다 */
  readonly mode?: SpecialSwingWindowMode
  /**
   * 지금 쓰는 기술 번호 — 원본 선수 레코드 **+0x18**.
   * 넘기지 않으면 창이 스스로 들고 있다가 `onSelectNumber` 로만 알린다.
   */
  readonly selectedNumber?: number
  /** 확인 키로 기술을 바꿨을 때 (0x17cec 3번 갈래의 "예") */
  readonly onSelectNumber?: (number: number) => void
  /** `'훈련'` 모드가 보는 값 — 인기도 조건(StrMODE[62])과 G 부족(StrMODE[65]) 가드가 쓴다 */
  readonly popularity?: number
  readonly gamePoint?: number
  /** StrMODE[66] "배우시겠습니까?" 에 "예" 를 했을 때 (원본은 상태 0x7d → 0xa3bac 칸 4) */
  readonly onTrain?: () => void
  /** StrMODE[65] "구매 페이지로 이동하시겠습니까?" 에 "예" 를 했을 때 */
  readonly onBuyGamePoint?: () => void
  readonly onClose: () => void
}

/**
 * 필살타법 창 (0x803d4 탭 0) — 칸 4개 · 이름 · 설명 · 훈련 횟수. 나만의리그 장면 위에 뜬다. 그림은 `SpecialTrainingFigure`
 * (투수 108 탭 1 마구 창과 같은 그림), 여기는 두 상태의 키 가드만 맡는다.
 *
 * 이름은 `StrCOMMON[24 + 기술번호]` 이고 기술 번호는 [1,2,3,4] 인데,
 * **넷째 칸만 `4 + 타입`**(레코드 +0xb 위 3비트)이다 (H-4 확정):
 * 타격형이면 미라지 스윙, 장타형이면 **메테오 스윙**.
 *
 * 칸에 붙는 주황 아이콘은 "레벨" 이 아니라 **지금 쓰는 기술**(레코드 +0x18)이다 (R7 4절 정정) — 아이콘은 `min(+0x18, 4) == i + 1`,
 * 아래 글 "사용중" · [69] 는 0xa43c4(4 + 타입) 로 서로 다르다(0x805f4 · 0x80be8).
 * 확인 키(Enter)는 모드에 따라 `0x17cec`(고르기) 또는 `0x17828`(배우기) 규칙을 탄다.
 */
export function SpecialSwingWindow({
  level,
  sessions,
  battingTypeIndex,
  mode = '사용',
  selectedNumber,
  onSelectNumber,
  popularity = 0,
  gamePoint = 0,
  onTrain,
  onBuyGamePoint,
  onClose,
}: SpecialSwingWindowProps) {
  // 처음 커서 — '훈련'(108 진입 0x17730 177b6~17806)은 min(s8 [저장+0x201], 3) = min(L, 3) 칸.
  // '사용'(123 진입 0x17690)은 0x80235 가 탭 격자를 vt+0x14(0, 0) 으로 되감고 더 건드리지 않는다 — 칸 0
  const [cursor, setCursor] = useState(mode === '훈련' ? Math.min(level, SPECIAL_TRAINING_SLOT_COUNT - 1) : 0)
  /** 바깥이 번호를 들고 있지 않을 때의 자리 — 원본 레코드 +0x18 에 이어야 한다 */
  const [ownNumber, setOwnNumber] = useState(NO_SPECIAL_SWING_NUMBER)
  const inUseNumber = selectedNumber ?? ownNumber
  const [notice, setNotice] = useState<string | null>(null)
  const [question, setQuestion] = useState<{ readonly text: string; readonly onYes: () => void } | null>(null)

  const chooseNumber = (number: number) => {
    setOwnNumber(number)
    onSelectNumber?.(number)
  }

  /** 상태 0x7b 확인 키 — 0x17cec */
  const confirmUse = (slot: number) => {
    const pick = specialSwingPickOf(slot, battingTypeIndex, level, inUseNumber)
    if (pick.kind === '사용중') return setNotice(textOf(TEXT.사용중))
    if (pick.kind === '미습득') return setNotice(textOf(TEXT.미습득))
    setQuestion({
      text: textOf(TEXT.사용확인).replace('%s', pick.name),
      onYes: () => chooseNumber(pick.number),
    })
  }

  /** 상태 0x6c 확인 키 — 0x17828 */
  const confirmTraining = (slot: number) => {
    const career = { specialSwingLevel: level, popularity, gamePoint }
    const block = specialSwingSlotBlockOf(career, slot)
    if (block === '훈련완료') return setNotice(textOf(TEXT.훈련완료))
    if (block === '인기도부족') {
      const required = SPECIAL_SWING_REQUIRED_POPULARITY[slot] ?? 0
      return setNotice(textOf(TEXT.인기도부족).replace('%d', String(required)))
    }
    if (block === '선행필요') return setNotice(textOf(TEXT.선행필요))
    if (block === 'G포인트부족') {
      // 예/아니오 (2,2) — "예" 는 G 구매 페이지다. 웹에 그 페이지가 없으면 닫기만 한다
      return setQuestion({ text: textOf(TEXT.G포인트부족), onYes: () => onBuyGamePoint?.() })
    }
    const cost = specialSwingSlotCostOf(slot)
    setQuestion({
      text: textOf(TEXT.배우기확인).replace('%d', String(cost)),
      onYes: () => onTrain?.(),
    })
  }

  const confirm = (slot: number) => (mode === '훈련' ? confirmTraining(slot) : confirmUse(slot))

  useEffect(() => {
    // 알림·질문 상자가 떠 있으면 MessageBox 가 잡는 단계에서 키를 가져간다
    // 키 0x17828(108) · 0x17cec(123): OK(−5 · '5')는 칸 가드, 취소(−16)는 바깥(`back`)이 받는다, 그 밖은 창 키 0x80269 → 탭 격자
    const onKey = (event: KeyboardEvent) => {
      const key = specialTrainingKeyOf(event.key)
      if (key === null || key === 'clr') return
      event.preventDefault()
      if (key === 'ok') return confirm(cursor)
      setCursor((current) => moveSpecialTrainingCursor(current, key))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div
      className={notice !== null || question !== null ? `${styles.overlay} ${styles.overlayWithPopup}` : styles.overlay}
      role="dialog"
      aria-label="필살타법"
      onClick={onClose}
    >
      <SpecialTrainingFigure
        side="타자"
        state={mode}
        cursor={cursor}
        learnedCount={level}
        sessions={sessions}
        inUseNumber={inUseNumber}
        typeIndex={battingTypeIndex}
        onPressSlot={(slot) => {
          setCursor(slot)
          confirm(slot)
        }}
      />

      {/* 상자 클릭이 덮개(onClick = onClose)로 올라가 창째 닫히지 않게 여기서 멈춘다 — 원본은 상자가 키를 다 가져간다 */}
      <div onClick={(event) => event.stopPropagation()}>
        {question !== null && (
          <MessageBox
            text={question.text}
            buttons={['예', '아니오']}
            onAnswer={(index) => {
              const pending = question
              setQuestion(null)
              if (index === 0) pending.onYes()
            }}
          />
        )}
        {question === null && notice !== null && <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />}
      </div>
    </div>
  )
}
