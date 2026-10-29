import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { MarkupText } from '@/shared/ui'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { TRADE_FAILURE, TRADE_PROGRESS, TRADE_SUCCESS, type TradeProgressStage } from './tradeTexts'

/**
 * 진행 게이지 판 — 그림 자료 `[[장면+0xc8]+0xc]+8` 의 +0x120 = **mode_ui 프레임 72** (0x120 / 4) 의 **박스 1** (37, 216, 169, 13)
 * (0x94a65(…, 프레임 72, 0, 1) — 갱신 0xcecc 와 그림 0xdc6c 가 같은 박스를 읽는다). 게이지 끝(this+0x164 의 상한)도 그 너비 169 다.
 * 그림 0xdc4a 가 먼저 읽는 박스 0 (35, 186, 174, 45) 은 창 0x802dd(창) 에 넘기지 않고 덮여 쓰인다 — 쓰는 곳이 없다.
 */
const PROGRESS_BOX = { x: 37, y: 216, width: 169, height: 13 } as const
/** 0xcecc — 갱신마다 this+0x164 += 2 */
const PROGRESS_STEP = 2
/** 단계 1 은 건너뛰기, 단계 2·3 은 끝 — 확인(−5 · '5') · 취소(−16) */
const PROGRESS_KEYS = ['Enter', ' ', '5', 'Escape', 'Backspace']
/** 단계마다 글 — 단계 2 초록 (0, 0xff, 0) de00~de06 · 단계 3 빨강 (0xff, 0, 0) de1e~de24 */
const RESULT_TEXT: Readonly<Record<Exclude<TradeProgressStage, '진행'>, string>> = {
  성공: `!C!c00FF00${TRADE_SUCCESS}`,
  실패: `!C!cFF0000${TRADE_FAILURE}`,
}

interface TradeProgressProps {
  readonly stage: TradeProgressStage
  /** 게이지가 다 찬 틀 — 0xcf24 가 G 를 빼고 굴려 단계 2·3 으로 */
  readonly onComplete: () => void
  /** 단계 2·3 에서 확인(−5 · '5')·취소(−16) — 0xc7ba: 요청 플래그 0 · 0xc9 */
  readonly onFinish: () => void
}

/** 단계 1 글 — [173] + "." × this+0x168 (틀 수 & 3 == 0 마다 +1, 4 에서 0) */
const progressTextOf = (stage: TradeProgressStage, update: number) =>
  stage === '진행' ? `!C!cFFFFFF${TRADE_PROGRESS}${'.'.repeat(Math.floor(update / 4) % 4)}` : RESULT_TEXT[stage]

/**
 * 0xe7 진행 연출 (갱신 0xcf24 → 0xcecc · 키 0xc66c 단계 1~3 · 그림 0xd4e8 의 0xdc42~0xde58, 직접 떴다):
 * ```
 * 판   (0x18, 0x34, 0x7c) 사각 · 게이지 (0x47, 0xdb, 0) 너비 this+0x164 · 밑줄 (0x3a, 0xc5, 0) 1px
 *      게이지 > 2 면 안쪽 윗줄 (0x85, 0xe9, 0x1c) 5px
 * 단계 1  [173] + "." × this+0x168 (틀 수 & 3 == 0 마다 +1, 4 에서 0) — 흰 글, 판 위 22px
 *         0xcecc: this+0x164 += 2, 너비에 닿으면 참 → 굴림
 *         키 확인 · '5' · 취소 → this+0x164 = 너비 (다음 틀에 끝난다)
 * 단계 2  [174] 초록 (0, 0xff, 0) — de00~de06 `r1 = 0xff · r2 = 0 · r0 = 0` → 0x1400748(r, g, b)
 * 단계 3  [175] 빨강 (0xff, 0, 0) — de1e~de24
 * 글은 0xba411(박스 1, 글, 0x22, …, dy −22) — 박스 1 가운데, 22px 위
 *         키 확인 · '5' · 취소 → 0xc9
 * ```
 */
export function TradeProgress({ stage, onComplete, onFinish }: TradeProgressProps) {
  const update = useUpdateCounter(stage === '진행')
  const [isSkipped, setSkipped] = useState(false)
  const isCompleted = useRef(false)
  const isGaugeFull = stage !== '진행' || isSkipped
  const gauge = isGaugeFull ? PROGRESS_BOX.width : Math.min((update + 1) * PROGRESS_STEP, PROGRESS_BOX.width)

  // 다 찬 틀에 한 번만 굴린다 — 건너뛰기면 그다음 틀
  const complete = useEffectEvent(onComplete)
  const [skippedAt, setSkippedAt] = useState<number | null>(null)
  useEffect(() => {
    if (stage !== '진행' || isCompleted.current) return
    const isFull = (update + 1) * PROGRESS_STEP >= PROGRESS_BOX.width
    const isSkipDone = skippedAt !== null && update > skippedAt
    if (!isFull && !isSkipDone) return
    isCompleted.current = true
    complete()
  }, [stage, update, skippedAt])

  /** 단계 1 의 확인·취소 — this+0x164 = 너비 (0xc76e~0xc7b6) */
  const skip = () => {
    setSkipped(true)
    setSkippedAt((current) => current ?? update)
  }
  const press = () => (stage === '진행' ? skip() : onFinish())

  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    if (!PROGRESS_KEYS.includes(event.key)) return
    event.preventDefault()
    press()
  })
  // 등록 차례는 옛 그대로 — 단계 · 틀 · onFinish 가 바뀔 때마다 다시 건다(다른 keydown 처리기와의 차례가 같게)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleKey(event)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stage, update, onFinish])

  const box = PROGRESS_BOX
  return (
    <div role="status" aria-label="트레이드 진행" onClick={press} style={{ position: 'absolute', left: 0, top: 0, width: 240, height: 320 }}>
      <div style={{ position: 'absolute', left: box.x, top: box.y - 22, width: box.width }}>
        <MarkupText raw={progressTextOf(stage, update)} />
      </div>
      <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height, background: 'rgb(24, 52, 124)' }} />
      <div
        data-testid="트레이드-게이지"
        style={{ position: 'absolute', left: box.x, top: box.y, width: gauge, height: box.height, background: 'rgb(71, 219, 0)' }}
      />
      <div style={{ position: 'absolute', left: box.x, top: box.y + box.height - 1, width: gauge, height: 1, background: 'rgb(58, 197, 0)' }} />
      {gauge > 2 && (
        <div style={{ position: 'absolute', left: box.x + 1, top: box.y + 1, width: gauge - 2, height: 5, background: 'rgb(133, 233, 28)' }} />
      )}
    </div>
  )
}
