import { useEffect, useRef, useState } from 'react'
import { setAppTickInterval } from '@/shared/lib/frameClock/frameClock'
import type { CSSProperties } from 'react'
import { MarkupText, PressArea } from '@/shared/ui'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { flippedFrameUrlOf, frameCopiesUrl, hasFrameCopies } from '@/shared/lib/sprite/frameCopies'
import { useSpriteJson } from '@/shared/lib/sprite/useSpriteJson'
import { useWholeScreenOffset } from '@/shared/lib/screenShake/useWholeScreenOffset'
import { useCommonWindowPush } from '@/shared/lib/commonWindow/commonWindow'
import type { BurstJudgement } from '@/entities/burst-mission/model/burstMissionJudge'
import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'
import type { OriginalBurstLine } from '@/shared/config/original/burstMissions'
import {
  BURST_BAND_HEIGHT, BURST_BAND_SLASH_LENGTH, BURST_BAND_SLASH_X, BURST_COLORS, BURST_NEXT_MARK_IMAGE, BURST_SCREEN,
  BURST_WINDOW_START, burstBandTopOf, burstLineIndexOf, burstNextMarkAt, burstPortraitAnchorOf, burstPortraitOf,
  burstResultPopupTextOf, burstShakeOffsetOf, burstSpeakerPrefixOf, burstTextBoxOf, isBurstWindowOpen, tickBurstWindow,
  burstObjectTicks,
} from '@/widgets/burst-mission/lib/burstMissionWindowLayout'
import type { BurstWindowState } from '@/widgets/burst-mission/lib/burstMissionWindowLayout'
import { SCREEN_LAYERS } from '@/shared/config/screenLayers'
import * as styles from '@/widgets/burst-mission/ui/BurstMissionWindow.css'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

interface BurstMissionWindowProps {
  /**
   * 그 행의 `_TEXT` 4줄 — 0 제안 · 1 성공 · 2 실패 · 3 무효.
   * `ORIGINAL_BURST_TABLES[표].lines[행]` 을 그대로 넘기면 된다.
   */
  readonly lines: readonly OriginalBurstLine[]
  /**
   * `null` 이면 **제안** 모습(발동한 순간, 줄 0), 아니면 **결과** 모습이다.
   * `resolveBurst` 가 돌려주는 판정을 그대로 넘긴다.
   */
  readonly judgement: BurstJudgement | null
  /**
   * 판정이 난 행 — 결과를 닫을 때 공용 창에 띄울 보상 글(0x8e5b8)을 짓는다. 없으면 창을 안 띄운다.
   * `resolveBurst` 의 `row` 를 그대로 넘긴다.
   */
  readonly row?: BurstMissionRow | null
  /** 지금 타자가 좌타인가 — 0xb63c0(지금 타자). 초상이 왼쪽에 뒤집혀 선다. 안 넘기면 우타 */
  readonly isBatterLeftHanded?: boolean
  /** 대사 안 %s 를 순서대로 채울 값 */
  readonly replacements?: readonly string[]
  /** 창을 닫고 다음으로 간다 — 제안이면 타석(상태 0xf), 결과면 보상 적용 뒤 원래 흐름 */
  readonly onClose: () => void
}

/**
 * **돌발미션 창** — 경기 장면 상태 0x1b (그리기 0x8f3c0 · 갱신 0x8e5b8 — 배치 · 차례는 `lib/burstMissionWindowLayout` 머리글).
 *
 * 대사를 실은 뒤 판이 아래에서 오르고(0 → 2 → 6 → 14 → 30 → 55), 다 오르면 화면이 세 그림 위아래로 흔들린 뒤(+1 · −1 · +1)
 * 화자 이름 머리와 대사 · 넘김 표시가 나온다. 그때부터 아무 키나 받아 닫는다(원본 키 [장면+0x40] 은 키를 가리지 않는다).
 * 결과(성공 · 실패)를 닫을 때 보상 글을 공용 창 [0x140005c] 에 띄운다(0x74ef5).
 *
 * 효과음(제안 0x2a · 성공 0x24 · 실패 0x20 · 무효 0x25)은 싣는 쪽(발동 0x8f000 · 판정 0x8f414)이 낸다 — 이 창 몫이 아니다.
 *
 * 넘김 표시 위아래 차례 [+0x224] 는 경기 내내 이어 센다 — 창은 `burstObjectTicks` 에서 이어 받고 돌려 적는다(r181 확정).
 * ⚠️ 유력: 초상 깃발 0x11 을 좌우 뒤집기로 본 것(엔딩 · 제작진과 같은 읽기, `FramePiece`).
 */
export function BurstMissionWindow({
  lines, judgement, row = null, isBatterLeftHanded = false, replacements = [], onClose,
}: BurstMissionWindowProps) {
  const line = lines[burstLineIndexOf(judgement)]
  const [state, setState] = useState<BurstWindowState>(
    () => tickBurstWindow({ ...BURST_WINDOW_START, ticks: burstObjectTicks.value }))
  /** 그린 수 — 초상 애니는 그린 뒤 한 칸 나아간다(0x93d91) */
  const [draws, setDraws] = useState(0)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    burstObjectTicks.value = stateRef.current.ticks
    const timer = setAppTickInterval(() => {
      const next = tickBurstWindow(stateRef.current)
      burstObjectTicks.value = next.ticks
      stateRef.current = next
      setState(next)
      setDraws((count) => count + 1)
    })
    return () => timer()
  }, [])

  useWholeScreenOffset(burstShakeOffsetOf(state))

  const pushCommonWindow = useCommonWindowPush()
  const closeRef = useRef(() => {})
  closeRef.current = () => {
    if (!isBurstWindowOpen(stateRef.current)) return
    const popup = burstResultPopupTextOf(judgement, row)
    if (popup !== null) pushCommonWindow(popup)
    onClose()
  }

  // 창이 떠 있는 동안 키는 창 것이다 — 뒤 타석 화면이 같은 Enter 를 같이 받으면 스윙이 나간다.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 잡는 단계에서 멈춰 뒤쪽 타석·커맨드 줄의 window 리스너까지 막는다
      event.stopImmediatePropagation()
      event.preventDefault()
      // 0x8e60c — 다 열리기 전(c ≠ −1)의 키는 버려진다
      closeRef.current()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  const isOpen = isBurstWindowOpen(state)
  const bandTop = burstBandTopOf(state.height)
  const bodyTop = BURST_SCREEN.height - state.height
  const textBox = burstTextBoxOf(state.height)
  const nextMark = burstNextMarkAt(state.ticks)

  return (
    // 겹 차례 — 경기 화면의 누름 칸(PressArea 7: 다음 타석 OK 대기 0xe 의 '확인' · 도루 · '*')보다 위다. 결과 창이 설 때 다음 타석의
    // 0xe 대기가 이미 실려 화면 전체 '확인' 칸(창 동안은 꺼짐)이 서는데, 이 창(예전 5)이 그 아래라 클릭 · 탭이 꺼진 칸에 먹혔다(r195)
    <div className={styles.overlay} style={{ zIndex: SCREEN_LAYERS.SCENE_WINDOW }} role="dialog" aria-label="돌발미션"
      onPointerDown={(event) => event.stopPropagation()}>
      {line !== undefined && (
        <BurstPortrait speaker={line.speaker} expression={line.expression} draws={draws}
          anchor={burstPortraitAnchorOf(state.height, isBatterLeftHanded)} />
      )}
      <svg className={styles.layer} width={BURST_SCREEN.width} height={BURST_SCREEN.height}
        viewBox={`0 0 ${BURST_SCREEN.width} ${BURST_SCREEN.height}`} shapeRendering="crispEdges" aria-hidden>
        {/* 0x8f194 윗 띠 */}
        <rect x={0} y={bandTop} width={BURST_SCREEN.width} height={BURST_BAND_HEIGHT} fill={BURST_COLORS.bandEdge} />
        <rect x={0} y={bandTop + 1} width={BURST_SCREEN.width} height={BURST_BAND_HEIGHT - 2} fill={BURST_COLORS.bandLight} />
        <rect x={0} y={bandTop + 2} width={BURST_SCREEN.width} height={BURST_BAND_HEIGHT - 2} fill={BURST_COLORS.bandFill} />
        {Array.from({ length: BURST_BAND_SLASH_LENGTH }, (_, i) => {
          const x = BURST_BAND_SLASH_X + i
          const y = bandTop + BURST_BAND_HEIGHT - 1 - i
          return (
            <g key={i}>
              <rect x={x} y={y} width={1} height={1} fill={BURST_COLORS.bandEdge} />
              <rect x={x - 1} y={y} width={1} height={1} fill={BURST_COLORS.bandLight} />
              <rect x={x + 1} y={y} width={1} height={1} fill={BURST_COLORS.bandLight} />
            </g>
          )
        })}
        {/* 0x8f392 본체 — 검정 알파 0xB4 */}
        <rect x={0} y={bodyTop} width={BURST_SCREEN.width} height={state.height} fill={BURST_COLORS.body} />
      </svg>
      {isOpen && line !== undefined && (
        <>
          <div className={styles.dialogue} style={{ left: textBox.x, top: textBox.y, width: textBox.width }}>
            <MarkupText raw={burstSpeakerPrefixOf(line.speaker) + line.text} replacements={replacements} />
          </div>
          <img className={styles.sprite} style={{ left: nextMark.x, top: nextMark.y }} src={BURST_NEXT_MARK_IMAGE} alt="" />
        </>
      )}
      {/* 0x8e60c — 열린 뒤(c = −1)에는 키를 가리지 않고 닫는다. 누름도 아무 키와 같은 길이라 화면 어디를 눌러도 닫는다(Enter 와 같다) */}
      <PressArea label="돌발미션 넘기기" onPress={() => closeRef.current()} isDisabled={!isOpen} testId="돌발미션-넘기기" />
    </div>
  )
}

/** 0x8f29c 초상 — 0x63a04 애니를 그린 뒤 한 칸 나아간다(되풀이) */
function BurstPortrait({ speaker, expression, draws, anchor }: {
  readonly speaker: number
  readonly expression: number
  readonly draws: number
  readonly anchor: { readonly x: number; readonly y: number; readonly isFlipped: boolean }
}) {
  const portrait = burstPortraitOf(speaker, expression)
  const folder = assetUrl(`./sprites/${portrait?.file ?? 'event_char_0'}/frames`)
  const origins = useFrameOrigins(folder)
  const animations = useAnimations(folder)
  // 좌타는 깃발 0x11 로 그린다(0x8f310~) — 0xc9f98 ca07c 갈래라 0x66 반투명 파트(볼터치)도 섞지 않고 복사한 판(`frameCopies`)
  const copies = useSpriteJson<unknown>(anchor.isFlipped && hasFrameCopies(folder) ? frameCopiesUrl(folder) : null)
  if (portrait === null) return null
  const entries = animations?.[portrait.animation]
  const step = entries === undefined ? null : animationStepAt(entries, draws)
  if (step === null) return null
  const key = String(step.frame).padStart(3, '0')
  const origin = origins?.[key]
  if (origin === undefined) return null
  const x = anchor.x + step.dx
  const y = anchor.y + step.dy
  const style: CSSProperties = anchor.isFlipped
    ? { left: x - origin.x - origin.width, top: y + origin.y, transform: 'scaleX(-1)' }
    : { left: x + origin.x, top: y + origin.y }
  const src = anchor.isFlipped ? flippedFrameUrlOf(folder, step.frame, copies) : `${folder}/${key}.png`
  return <img className={styles.sprite} style={style} src={src} alt="" data-frame={step.frame} />
}

