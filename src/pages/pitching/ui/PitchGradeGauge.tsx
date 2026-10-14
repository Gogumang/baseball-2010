import { useEffect, useRef, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { GAUGE_LAST_CELL } from '@/entities/pitcher-career/model/pitchGauge'
import {
  gaugePressedCellOf,
  isPitchReleaseDue,
  originalKeyCodeOf,
  KEY_OK,
} from '@/features/play-pitcher-game/model/pitchAim'
import { gaugeTapRectOf } from '@/pages/pitching/lib/pitchInputTapZones'
import { showsGaugeTargetFrameOf } from '@/widgets/batting-stage/lib/pitchInputOverlay'
import { PressArea } from '@/shared/ui'
import { PressLayer } from '@/pages/pitching/ui/PressLayer'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import { usePublishedOverlay } from '@/pages/pitching/model/pitchInputOverlayRef'
import type { PitchInputOverlayRef } from '@/pages/pitching/model/pitchInputOverlayRef'

interface PitchGradeGaugeProps {
  /**
   * 공을 놓는다 — 상태 0x11 의 틱 10(`0x4e060`, `[+0x2c] > 9`)에 **누르든 안 누르든** 한 번 불린다.
   * 넘기는 값은 게이지에서 정한 칸 g(1~9). 칸을 못 정했으면 0 (그때 등급 t = 0).
   */
  readonly onRelease: (gaugeCell: number) => void
  /** 일시정지 팝업(0x741a0)이 떠 있으면 틱이 멈춘다 */
  readonly isPaused?: boolean
  /**
   * 게이지를 쓰는 공인가 (`0x3f500` — 환경설정 게이지 켬 ∧ 구질 ≠ 22 마구). 원본은 0x10 OK(0x50e9c → 0x50ed0)에서 **늘** 0x11 로
   * 가고 틱 10 에 놓는다(0x4e060) — 게이지를 안 쓰는 공은 그리기 0x4d2ac 가 0x4d3f8 에서 게이지를 건너뛸 뿐이다. 그래서 거짓이면
   * 아무것도 안 그리고 누름도 안 받은 채 틱 10 에 칸 0 으로 놓는다(등급은 놓기 0x4dbac 가 제구·체력 표로 뽑는다). 기본 참
   */
  readonly showsGauge?: boolean
  /**
   * 장면 위 게이지(0x4d2ac — 목표점의 slt_pitch 원)의 재료를 실을 칸 — 확정한 조준점 · 투영 칸 · 환경설정 게이지(+0x2d).
   * 누름 칸도 그 목표점 둘레에 선다. 안 넘기면(장면 없음) 누름 칸이 판 전체다
   */
  readonly overlay?: {
    readonly ref: PitchInputOverlayRef
    readonly aim: WorldPoint
    readonly aimSide: number
    readonly gaugeSettingOn: boolean
    /**
     * 경기 모드 [+0x1104] — 목표 표시 프레임 0x23 판정 0x4d360(`showsGaugeTargetFrameOf`)이 본다. 이 부품은 사람이 던질 때만 서므로
     * 공격 측은 늘 CPU 다(이글아이 줄 4d380 은 사람 공격 갈래라 안 탄다). 안 주면 예전처럼 게이지 설정만 본다
     */
    readonly gameMode?: number
  }
}

const isDecidedCell = (cell: number) => cell >= 1 && cell <= GAUGE_LAST_CELL

/**
 * 원본 투구 게이지 — 경기 상태 0x11 (그리기 0x4d2ac, 누름 0x50e08, 놓기 0x4e060 — P1 4-1 · S5 U-15).
 *
 * - 커서 칸 `scene+0x17bc` 는 등급 t 가 0 인 동안 그리기 함수가 **틱마다 +1** 한다(0x4d708).
 * - OK · '5'(메시지 9 → 0x50e08)는 `+0x17c8 = 커서`(이미 정했으면 그대로)로 적고, 칸이 1~9 일 때만 t 를 정한다 —
 *   커서 0 에서 누르면 무시되고 **다시 누를 수 있다**. t 가 서면 커서가 멈추고 결과 원(0x4d6aa)이 4틱 떠오른다.
 * - 누름은 공을 내보내지 않는다. 공은 **틱 10 에 늘 나간다**(0x4e060 → 0x4dc78) — 그때까지 못 정했으면 t = 0.
 *
 * ⚠️ **원본 그대로**: 칸 8 과 9 는 프레임을 `min(…, 0x43)` 으로 자르는 바람에 **화면에서 구별되지 않고**,
 * 칸 9 는 원이 사라진 바로 그 한 틱이다. 원본에 결과 글자가 없어 안내 문구도 붙이지 않는다.
 *
 * 그림은 모두 장면이 그린다(`widgets/batting-stage/lib/pitchInputOverlay` 의 `gaugeDrawsOf`) — t 가 선 뒤 0x4d52e~0x4d706 의
 * 멈춘 커서(효과 1 · 인자 8 = 반투명 8/16) · 애니 1 의 끝 비트가 서기 전 누른 칸 원 · 애니 1 · t == 5 의 game_effect 애니 0 ·
 * 끝 비트 뒤 결과 원(효과 1 · 인자 15 − 3·[+0x17c4] 로 옅어짐)까지. 이 부품은 그 재료(커서 `+0x17bc` · 누른 칸 `+0x17c8` ·
 * 정한 뒤 그림 수)를 싣고, 마우스 길로 목표점 둘레의 **투명한 누름 칸**(OK)만 낸다.
 */
export function PitchGradeGauge({ onRelease, isPaused = false, showsGauge = true, overlay }: PitchGradeGaugeProps) {
  /** 0x11 상태 틱 `[+0x2c]` */
  const tickRef = useRef(0)
  /** 커서 `+0x17bc` */
  const [cursor, setCursor] = useState(0)
  const cursorRef = useRef(0)
  /** 누른 칸 `+0x17c8` (0 = 아직) */
  const [pressed, setPressed] = useState(0)
  const pressedRef = useRef(0)
  /** 결과 원 틱 `+0x17c4` */
  const [resultTick, setResultTick] = useState(0)
  const releasedRef = useRef(false)
  usePublishedOverlay(
    overlay?.ref,
    overlay === undefined
      ? null
      : {
          kind: '게이지',
          aim: overlay.aim,
          aimSide: overlay.aimSide,
          showsGauge,
          gaugeSettingOn: overlay.gaugeSettingOn,
          ...(overlay.gameMode === undefined
            ? {}
            : {
                showsTargetFrame: showsGaugeTargetFrameOf({
                  mode: overlay.gameMode,
                  // ⚠️ 웹 난이도(설정 +0x2c)는 늘 2 — 4d366 의 난이도 0 갈래는 안 탄다
                  difficulty: 2,
                  isAttackSideHuman: false,
                  eagleEyeGames: 0,
                  gaugeSettingOn: overlay.gaugeSettingOn,
                }),
              }),
          cursor,
          pressed,
          decidedTicks: resultTick,
        },
  )
  const onReleaseRef = useRef(onRelease)
  onReleaseRef.current = onRelease

  useEffect(() => {
    if (isPaused) return
    const handle = window.setInterval(() => {
      if (releasedRef.current) return
      tickRef.current += 1
      if (isPitchReleaseDue(tickRef.current)) {
        releasedRef.current = true
        onReleaseRef.current(isDecidedCell(pressedRef.current) ? pressedRef.current : 0)
        return
      }
      // 그리기 0x4d2ac — t 가 0 이면 커서 +1, 서 있으면 결과 원 틱 +1 (0x4d700 · 0x4d708)
      if (isDecidedCell(pressedRef.current)) {
        setResultTick((previous) => previous + 1)
      } else {
        cursorRef.current += 1
        setCursor(cursorRef.current)
      }
    }, millisecondsPerFrame())
    return () => window.clearInterval(handle)
  }, [isPaused])

  const press = () => {
    if (releasedRef.current || isPaused || !showsGauge) return
    pressedRef.current = gaugePressedCellOf(pressedRef.current, cursorRef.current)
    setPressed(pressedRef.current)
  }
  const pressRef = useRef(press)
  pressRef.current = press
  const isPausedRef = useRef(isPaused)
  isPausedRef.current = isPaused

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isPausedRef.current) return
      const code = originalKeyCodeOf(event.key)
      // 메시지 9 의 0x50dfa — OK(−5) · '5' 만 0x50e08 로 간다
      if (code !== KEY_OK && code !== 0x35) return
      event.preventDefault()
      pressRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // 게이지를 안 쓰는 공 — 0x11 의 10틱만 흘려 보낸다 (그림 없음)
  if (!showsGauge) return null

  const isDecided = isDecidedCell(pressed)
  return (
    <PressLayer testId="게이지 누름 칸">
      <PressArea
        {...(overlay === undefined ? {} : { rect: gaugeTapRectOf(overlay.aim, overlay.aimSide) })}
        label={`투구 게이지 ${isDecided ? pressed : cursor}칸`}
        onPress={press}
      />
    </PressLayer>
  )
}
