import { useEffect, useState } from 'react'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { MessageBox, SpriteNumber } from '@/shared/ui'
import { glyphsWidthOf, numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import {
  SPECIAL_SWING_REQUIRED_POPULARITY, specialSwingSlotBlockOf, specialSwingSlotCostOf,
} from '@/entities/career/model/training'
import {
  COUNT_BOX, COUNT_DIGIT_OFFSET_X, COUNT_LABEL_FRAME, COUNT_LABEL_OFFSET_X, CURSOR_BLINK_PERIOD,
  CURSOR_VISIBLE_UPDATES, DESCRIPTION_BOX, FRAME_IMAGE, NAME_BOX, SLOT_COUNT, SLOT_SIZE, SLOT_XS, SLOT_Y,
  SPECIAL_SWING_WINDOW, TITLE_BOX, TITLE_FRAME, unlockedSlotCountOf,
} from '@/widgets/special-swing/lib/specialSwingLayout'
import {
  NO_SPECIAL_SWING_NUMBER, specialSwingNameOf, specialSwingNumberOf, specialSwingPickOf,
} from '@/widgets/special-swing/lib/specialSwingSelection'
import { SpecialSwingSlot } from '@/widgets/special-swing/ui/SpecialSwingSlot'
import * as styles from '@/shared/ui/GameWindow/GameWindow.css'
import * as local from '@/widgets/special-swing/ui/SpecialSwingWindow.css'

const IMG_TEXT = './sprites/img_text/frames'
const MODE_UI = './sprites/mode_ui/frames'
/** img_text 글자 그림 높이 */
const LABEL_HEIGHT = 10

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
 * 필살타법 창 (0x803d4) — 칸 4개 · 이름 · 설명 · 훈련 횟수. 나만의리그 장면 위에 뜬다.
 *
 * 이름은 `StrCOMMON[24 + 기술번호]` 이고 기술 번호는 [1,2,3,4] 인데,
 * **넷째 칸만 `4 + 타입`**(레코드 +0xb 위 3비트)이다 (H-4 확정):
 * 타격형이면 미라지 스윙, 장타형이면 **메테오 스윙**.
 *
 * 칸에 붙는 주황 아이콘은 "레벨" 이 아니라 **지금 쓰는 기술**(레코드 +0x18)이다 (R7 4절 정정).
 * 확인 키(Enter)는 모드에 따라 `0x17cec`(고르기) 또는 `0x17828`(배우기) 규칙을 탄다.
 */
export function SpecialSwingWindow({
  level, sessions, battingTypeIndex, mode = '사용', selectedNumber, onSelectNumber,
  popularity = 0, gamePoint = 0, onTrain, onBuyGamePoint, onClose,
}: SpecialSwingWindowProps) {
  const [cursor, setCursor] = useState(Math.min(Math.max(level - 1, 0), SLOT_COUNT - 1))
  /** 바깥이 번호를 들고 있지 않을 때의 자리 — 원본 레코드 +0x18 에 이어야 한다 */
  const [ownNumber, setOwnNumber] = useState(NO_SPECIAL_SWING_NUMBER)
  const inUseNumber = selectedNumber ?? ownNumber
  const [notice, setNotice] = useState<string | null>(null)
  const [question, setQuestion] = useState<{ readonly text: string; readonly onYes: () => void } | null>(null)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const update = useUpdateCounter()
  const isCursorVisible = update % CURSOR_BLINK_PERIOD < CURSOR_VISIBLE_UPDATES
  const unlockedCount = unlockedSlotCountOf(level)
  const widthOf = (frame: number) => textOrigins?.[String(frame).padStart(3, '0')]?.width ?? 0
  const countGlyphs = numberGlyphsOf(sessions)

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
    const onKey = (event: KeyboardEvent) => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (step !== 0) return setCursor((current) => (current + step + SLOT_COUNT) % SLOT_COUNT)
      if (event.key === 'Enter') {
        event.preventDefault()
        confirm(cursor)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className={styles.overlay} role="dialog" aria-label="필살타법" onClick={onClose}>
      <div className={styles.window}
        style={{ left: SPECIAL_SWING_WINDOW.x, top: SPECIAL_SWING_WINDOW.y, width: SPECIAL_SWING_WINDOW.width, height: SPECIAL_SWING_WINDOW.height }} />
      <img className={styles.layer} alt="" src={`./sprites/management/label_navy_${TITLE_FRAME}.png`}
        style={{ left: TITLE_BOX.x + Math.trunc((TITLE_BOX.width - widthOf(TITLE_FRAME)) / 2), top: TITLE_BOX.y + Math.trunc((TITLE_BOX.height - LABEL_HEIGHT + 1) / 2) }} />
      <img className={styles.layer} alt="" src={`${MODE_UI}/${String(FRAME_IMAGE.frame).padStart(3, '0')}.png`}
        style={{ left: FRAME_IMAGE.x, top: FRAME_IMAGE.y }} />

      {SLOT_XS.map((x, index) => (
        <button key={x} type="button" aria-label={specialSwingNameOf(specialSwingNumberOf(index, battingTypeIndex))}
          className={local.slotButton}
          style={{ left: x, top: SLOT_Y, width: SLOT_SIZE.width, height: SLOT_SIZE.height }}
          onMouseEnter={() => setCursor(index)}
          onClick={(event) => { event.stopPropagation(); setCursor(index); confirm(index) }} />
      ))}
      {SLOT_XS.map((x, index) => (
        <SpecialSwingSlot key={x} index={index} x={x} y={SLOT_Y}
          isInUse={specialSwingNumberOf(index, battingTypeIndex) === inUseNumber}
          isLocked={unlockedCount <= index} />
      ))}
      {isCursorVisible && (
        <svg className={styles.layer} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges">
          {/* 테두리는 칸을 1px 씩 둘러싼 (폭+2)×(높이+2) 상자다 — 선을 픽셀 칸 가운데에 두려고 반 칸 옮긴다 */}
          <rect x={SLOT_XS[cursor] - 0.5} y={SLOT_Y - 0.5} width={SLOT_SIZE.width + 1} height={SLOT_SIZE.height + 1}
            fill="none" stroke={ORIGINAL_COLORS.text} strokeWidth={1} />
        </svg>
      )}

      <div className={local.text} style={{ left: NAME_BOX.x, top: NAME_BOX.y + 1, width: NAME_BOX.width }}>
        {specialSwingNameOf(specialSwingNumberOf(cursor, battingTypeIndex))}
      </div>
      {/* 설명 문자열은 원본 문자열표 번호 계산(293/295)이 미해독이라 비워 둔다 */}
      <div className={local.text} style={{ left: DESCRIPTION_BOX.x, top: DESCRIPTION_BOX.y, width: DESCRIPTION_BOX.width }} />

      <SpriteNumber glyphs={countGlyphs}
        right={COUNT_BOX.x + Math.trunc((COUNT_BOX.width - glyphsWidthOf(countGlyphs)) / 2) + COUNT_DIGIT_OFFSET_X + glyphsWidthOf(countGlyphs)}
        boxTop={COUNT_BOX.y} boxHeight={COUNT_BOX.height} />
      <img className={styles.layer} alt="" src={`${IMG_TEXT}/${COUNT_LABEL_FRAME}.png`}
        style={{
          left: COUNT_BOX.x + Math.trunc((COUNT_BOX.width - widthOf(COUNT_LABEL_FRAME)) / 2) + COUNT_LABEL_OFFSET_X,
          top: COUNT_BOX.y + Math.trunc((COUNT_BOX.height - LABEL_HEIGHT + 1) / 2),
        }} />

      {question !== null && (
        <MessageBox text={question.text} buttons={['예', '아니오']}
          onAnswer={(index) => { const pending = question; setQuestion(null); if (index === 0) pending.onYes() }} />
      )}
      {question === null && notice !== null && (
        <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />
      )}
    </div>
  )
}
