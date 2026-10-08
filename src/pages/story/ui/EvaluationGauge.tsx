import { useEffect, useState } from 'react'
import { FrameSprite } from '@/shared/ui'
import { PixelText } from '@/shared/ui/PixelText/PixelText'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import {
  EVALUATION_GAUGE_ANCHOR, EVALUATION_GAUGE_FILL, EVALUATION_GAUGE_FRAMES, EVALUATION_GAUGE_SIGN_COLOR,
  evaluationGaugeRowsOf, evaluationGaugeValueOf, startEvaluationGauge, tickEvaluationGauge,
} from '@/pages/story/lib/evaluationGauge'

const MODE_UI = './sprites/mode_ui/frames'
const NUM = './sprites/num'
const pad = (frame: number) => String(frame).padStart(3, '0')
const layer = { position: 'absolute', imageRendering: 'pixelated', pointerEvents: 'none' } as const

interface EvaluationGaugeProps {
  /** S+0x4a — 이번 경기 인기도 변화 ([mgr+0x2e8]) */
  readonly popularityChange: number
  /** 0x8587c 의 d (`evaluationGaugeDivisorOf`) */
  readonly divisor: number
}

/**
 * **116 평가 이벤트의 인기도 변화 막대** — 0x8b5ac 가 [이벤트+0xb] 일 때 대사 상자(0x7fbc4) 뒤에 그리는
 * 0x847e0(막대) · 0x85944(부호 · 값) · 0x858cc(한 걸음) (배치는 `pages/story/lib/evaluationGauge`).
 * 틀마다 지금 줄 수로 그리고 한 걸음 — 틀 0 은 시작 값 그대로다.
 */
export function EvaluationGauge({ popularityChange, divisor }: EvaluationGaugeProps) {
  const [state, setState] = useState(() => startEvaluationGauge(popularityChange, divisor))
  const origins = useFrameOrigins(MODE_UI)

  useEffect(() => {
    const tick = window.setInterval(() => setState(tickEvaluationGauge), millisecondsPerFrame())
    return () => window.clearInterval(tick)
  }, [])

  const value = evaluationGaugeValueOf(popularityChange)
  const rows = evaluationGaugeRowsOf(state)
  return (
    <div data-testid="인기도-막대" data-rows={rows.length} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <FrameSprite folder={MODE_UI} frame={EVALUATION_GAUGE_FRAMES.base} origins={origins}
        x={EVALUATION_GAUGE_ANCHOR.x} y={EVALUATION_GAUGE_ANCHOR.y} />
      {rows.map((y) => (
        <FrameSprite key={y} folder={MODE_UI} frame={EVALUATION_GAUGE_FRAMES.fill} origins={origins}
          x={EVALUATION_GAUGE_FILL.x} y={y} />
      ))}
      {value.signs.map((place, index) => (
        <PixelText key={index}
          style={{ position: 'absolute', left: place.x, top: place.y, color: EVALUATION_GAUGE_SIGN_COLOR }}>
          {value.sign}
        </PixelText>
      ))}
      {value.digits.map((digit, index) => (
        <img key={index} style={{ ...layer, left: digit.x, top: digit.y }} src={`${NUM}/${pad(digit.image)}.png`} alt="" />
      ))}
    </div>
  )
}
