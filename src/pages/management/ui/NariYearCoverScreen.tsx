import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { PressArea, RawScreen, ScreenOverlay } from '@/shared/ui'
import { LeftFrame } from '@/shared/ui/LeftFrame/LeftFrame'
import { useImgTextPalettes } from '@/shared/ui/ImgTextPalette/ImgTextPalette'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { screenEffectFrameAt } from '@/entities/story/model/screenEffect'
import {
  YEAR_COVER_CLIP, YEAR_COVER_LABEL, YEAR_COVER_ORIGIN, YEAR_COVER_SCALE, resumeLeftFrameCoverOpacityAt, yearCoverDigitsOf,
  yearCoverStepAt,
} from '@/pages/management/lib/nariYearCover'
import type { YearCoverStep } from '@/pages/management/lib/nariYearCover'
import { SCREEN_LAYERS } from '@/shared/config/screenLayers'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')
const NUM_IMAGES = assetUrl('./sprites/num')

interface NariYearCoverScreenProps {
  /** S+0xb3 — 새 시즌 0x1b768 이 1 올린 뒤의 연차 idx (표지는 idx 에서 idx + 1 로 숫자를 굴린다) */
  readonly yearIndex: number
  /** 105 관리 화면으로 — 0x12190 의 `0xbcb49(0x69)` 가 적용되는 틀 */
  readonly onDone: () => void
  /**
   * 앞 화면 틀(0 = 0x1b768 을 부른 틀, 0~9)에 **앞 상태가 그 틀에 그리는 그림** — 원본은 0x1b768 뒤에도 앞 상태(114 끝 틀 0x19da4 ·
   * 이어하기 길의 100 · 1 · 105 · 115 · 114)가 매 틀 그리기를 돈다. 상태판은 새 시즌이 고친 S 를 읽는다. null 이면(또는 안 넘기면)
   * 화면 버퍼에 남은 앞 판을 멈춘 채 깐다(`LeftFrame`)
   */
  readonly previousScreenAt?: (frame: number) => ReactNode | null
  /**
   * 이 틀부터 센다 — 앞 화면 아홉 틀을 앞 화면 위에서 이미 돌았으면(134 · 141 — `YearCoverHoldLayer`) `YEAR_COVER_ENTRY_FRAMES`.
   * 안 주면 0(0x1b768 을 부른 틀)부터
   */
  readonly startFrame?: number
}

/** 효과기 덮개의 겹 — 장면 그리기 끝(1d4a4)에 칠해 앞 화면의 대화창 판(`StoryScreen` 30)보다 위 */
const YEAR_COVER_EFFECTOR_LAYER = 40

/** 효과기 덮개 — 종류 1 은 '검정에서밝아짐'(실제로는 어두워짐) · 종류 2 는 '검게어두워짐'(실제로는 밝아짐), 이름은 `screenEffect` 그대로 */
function coverOpacityOf(step: YearCoverStep): number {
  if (step.kind === '관리') return 0
  const fadeOut = step.fadeOutFrame === null ? null : screenEffectFrameAt('검정에서밝아짐', '검정', step.fadeOutFrame)
  const fadeIn = step.fadeInFrame === null ? null : screenEffectFrameAt('검게어두워짐', '검정', step.fadeInFrame)
  return (fadeIn ?? fadeOut)?.overlay?.opacity ?? 0
}

/**
 * **나리 137 새 시즌 "N년차" 표지** — 차례 · 그림 근거는 `lib/nariYearCover`. 새 시즌 처리 뒤 앞 화면이 아홉 틀 어두워지고,
 * 검정에서 밝아지며 "N년차" 의 숫자가 지난 연차에서 새 연차로 굴러 올라온 뒤 81 틀째(아무 키면 곧바로) 어두워져 105 로 간다.
 */
export function NariYearCoverScreen({ yearIndex, onDone, previousScreenAt, startFrame = 0 }: NariYearCoverScreenProps) {
  const frame = useUpdateCounter() + startFrame
  /** 키를 받은 137 틀 — 키 0x106a4 가 [장면+0x28c] = 0x51 을 넣는 틀(키가 든 그리기의 다음 틀) */
  const [skipAt, setSkipAt] = useState<number | null>(null)
  const step = yearCoverStepAt(frame, skipAt)
  const stepRef = useRef(step)
  stepRef.current = step
  const press = () => {
    const current = stepRef.current
    if (current.kind !== '표지' || !current.acceptsKey) return
    setSkipAt((previous) => previous ?? current.tick + 1)
  }
  const pressRef = useRef(press)
  pressRef.current = press
  useEffect(() => {
    const onKeyDown = () => pressRef.current()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const isDone = step.kind === '관리'
  useEffect(() => {
    if (isDone) onDoneRef.current()
  }, [isDone])

  const opacity = coverOpacityOf(step)
  return (
    <RawScreen>
      {step.kind === '앞화면' ? (previousScreenAt?.(frame) ?? <LeftFrame part="year-cover-left" />) : (
        <YearCover yearIndex={yearIndex} counter={step.kind === '표지' ? step.counter : 0} />
      )}
      {/* 효과기 0xbd844 — 장면 그리기 끝에 칠한다 */}
      {opacity > 0 && (
        // 앞 화면의 이벤트 판(대화창 겹 30)까지 덮는다
        <div data-testid="연차표지-효과기"
          style={{ position: 'absolute', inset: 0, background: '#000000', opacity, pointerEvents: 'none', zIndex: YEAR_COVER_EFFECTOR_LAYER }} />
      )}
      <PressArea label="건너뛰기" onPress={press} />
    </RawScreen>
  )
}

/**
 * **앞 화면 아홉 틀을 그 화면 위에서** — 새 시즌 0x1b768 을 부른 134(0x1b92c 1bb28) · 141(0x1bbc4 1be26)은 상태를 안 바꾸고 다음 틀부터
 * 제 그리기(134 대진판 0x19fc8 · 141 엔딩 0x882c4)를 돌며 효과기 끝을 기다린다(1bb2c~1bb64 · 1beb4~1beea — +0x289 && [효과기+4] &&
 * [효과기+0x10] == 2 → `0xbcb49(0x89)` · 효과기 종류 2). 웹은 그 화면을 내리지 않고 이 겹이 효과기만 칠한다(`yearCoverStepAt` 의
 * 0~9 틀) — 앞 화면은 새 시즌이 고친 S(소지금 · 연차)로 그대로 그린다. 끝을 본 다음 틀(10)에 `onDone` 이 137 을 띄운다.
 * 효과기가 도는 동안 장면 키 문 0x10758 · 0x10774(나리 장면 0x106 의 누름 · 뗌)가 키를 버린다 — 이 겹이 키와 누름을 먹는다.
 */
export function YearCoverHoldLayer({ onDone }: { readonly onDone: () => void }) {
  const frame = useUpdateCounter()
  const step = yearCoverStepAt(frame, null)
  const isDone = step.kind !== '앞화면'
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  useEffect(() => {
    if (isDone) onDoneRef.current()
  }, [isDone])
  // 앞 화면의 키 처리기(useEffect)보다 먼저 걸리게 레이아웃 효과에서 window 잡는 단계에 건다 (`NariScreenPush` 와 같은 문)
  useLayoutEffect(() => {
    const swallow = (event: KeyboardEvent) => {
      event.stopImmediatePropagation()
      event.preventDefault()
    }
    window.addEventListener('keydown', swallow, true)
    window.addEventListener('keyup', swallow, true)
    return () => {
      window.removeEventListener('keydown', swallow, true)
      window.removeEventListener('keyup', swallow, true)
    }
  }, [])
  // 끝을 본 뒤 137 이 서기까지의 틈은 효과기 종류 2 의 칠하기 0 과 같은 검정이다
  const opacity = isDone ? 1 : coverOpacityOf(step)
  return (
    <ScreenOverlay zIndex={YEAR_COVER_HOLD_LAYER}>
      <div data-testid="연차표지-앞화면-효과기" data-frame={frame}
        style={{ position: 'absolute', inset: 0, background: '#000000', opacity, pointerEvents: 'auto' }} />
    </ScreenOverlay>
  )
}

/** 앞 화면 효과기 겹 — 화면의 창(엔딩 효과기 50 따위)보다 위, 앱 공용 창(55)보다 아래 (`SCREEN_LAYERS`) */
const YEAR_COVER_HOLD_LAYER = SCREEN_LAYERS.COMMON_WINDOW - 1

/**
 * 이어하기 길의 앞 화면 틀 0~3 — 그리기가 없는 100 · 1 이라 버퍼에 남은 앞 장면 판(`LeftFrame`) 위에 쌓인 덮개
 * (`resumeCoverUnderlayAt` 의 '앞판' · `resumeLeftFrameCoverOpacityAt`). 네 틀 내내 같은 자리 같은 꼴이라 판은 처음 틀에 한 번 받는다
 */
export function YearCoverResumeLeftFrame({ frame }: { readonly frame: number }) {
  const opacity = resumeLeftFrameCoverOpacityAt(frame)
  return (
    <>
      <LeftFrame part="year-cover-resume-left" />
      {opacity > 0 && (
        <div data-part="year-cover-resume-cover"
          style={{ position: 'absolute', inset: 0, background: '#000000', opacity, pointerEvents: 'none' }} />
      )}
    </>
  )
}

/** 그리기 0x1cc4c — 검정 · 자르기 (0, 154, 240, 22) 안에 "년차"(img_text 398 팔레트 1) · 굴러가는 연차 숫자, 모두 두 배 */
function YearCover({ yearIndex, counter }: { readonly yearIndex: number; readonly counter: number }) {
  const palettes = useImgTextPalettes()
  const origins = useFrameOrigins(IMG_TEXT_FRAMES)
  const labelKey = String(YEAR_COVER_LABEL.frame).padStart(3, '0')
  const labelOrigin = origins?.[labelKey]
  const clip = YEAR_COVER_CLIP
  const scaled = { transform: `scale(${YEAR_COVER_SCALE})`, transformOrigin: '0 0', imageRendering: 'pixelated' } as const
  return (
    <div data-part="year-cover" data-counter={counter}
      style={{ position: 'absolute', inset: 0, background: '#000000', pointerEvents: 'none' }}>
      {palettes.definition}
      <div style={{ position: 'absolute', left: clip.x, top: clip.y, width: clip.width, height: clip.height, overflow: 'hidden' }}>
        {labelOrigin !== undefined && (
          // 프레임 그리기 0x944b4 효과 0x10 · b 2 — 파트 자리 X + dx·2
          <img src={`${IMG_TEXT_FRAMES}/${labelKey}.png`} alt="년차"
            style={{
              position: 'absolute',
              left: YEAR_COVER_ORIGIN.x + labelOrigin.x * YEAR_COVER_SCALE - clip.x,
              top: YEAR_COVER_ORIGIN.y + labelOrigin.y * YEAR_COVER_SCALE - clip.y,
              ...scaled,
              ...palettes.styleOf(YEAR_COVER_LABEL.frame, YEAR_COVER_LABEL.palette),
            }} />
        )}
        {yearCoverDigitsOf(yearIndex, counter).map((digit, index) => (
          <img key={index} src={`${NUM_IMAGES}/${String(digit.image).padStart(3, '0')}.png`} alt=""
            data-digit={digit.image - 0x14}
            style={{ position: 'absolute', left: digit.x - clip.x, top: digit.y - clip.y, ...scaled }} />
        ))}
      </div>
    </div>
  )
}
