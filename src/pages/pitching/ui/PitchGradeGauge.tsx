import { useEffect, useRef, useState } from 'react'
import { createSceneKeyLatch, openSceneKeyLatch, runSceneKeys } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { gameSceneTickSeenAt, inputTimeOf } from '@/shared/lib/sceneKeyLatch/shownSceneTicks'
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
import {
  createGameSceneDrawGate, gameSceneTickNow, isGameSceneFrozen, setGameSceneTickInterval,
} from '@/shared/lib/commonWindow/commonWindow'

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
  /**
   * 0x11 상태 틱 `[+0x2c]` — 이 부품은 0x10 이 0x11 을 예약한 틀(OK 를 읽은 틀)에 서고, 0x11 은 다음 틀 머리(0xbc9c8 bc9ec)에 틱 0 으로
   * 선다. 그래서 첫 셈(다음 장면 틱 머리)이 틱 0 이다 — 아직 안 셌으면 −1. 0x4e060 은 `[+0x2c] > 9`(틱 10)에 놓는다
   */
  const tickRef = useRef(-1)
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
                  // 난이도(설정 +0x2c)는 원본도 늘 기본 2 다 — 바꾸는 화면이 없다(P7 K2). 게다가 이 화면은 미션(모드 5)이라
                  // 4d366 의 난이도 0 갈래는 모드 5 · 6 에서 안 탄다
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
  /**
   * 받은 키 칸 — 메시지 9(OK · '5' → 0x50e08)는 받은 다음 틀의 키 0x498d4(52d9e)가 0x11 갱신보다 먼저 처리한다(`sceneKeyLatch`).
   * 받은 틱은 키 사건이 난 때 장면 화면에 있던 그림의 틱이다(`gameSceneTickSeenAt` — 투수편 장면이 적는다, r217)
   */
  const [keyLatch] = useState(() => createSceneKeyLatch(gameSceneTickNow, gameSceneTickSeenAt))
  /**
   * 그린 커서 기록 — 그림마다 (장면 틱, 그 그림의 커서 `+0x17bc`). 원본은 키를 받은 틀 = 마지막으로 그린 틀이라 누른 칸은 **사람이 본
   * 그림의 커서**다(다음 틀 머리의 0x50e08 이 그 틀 그리기 0x4d708 보다 먼저 읽는다). 웹은 커서를 틱 시계로 올리고 장면이 rAF 로 그리므로
   * 그리기가 밀리면 시각 틱 · 지금 커서가 본 그림보다 한두 칸 앞이다 — 본 틱의 커서로 정한다 (r217)
   */
  const drawnCursorsRef = useRef<{ readonly tick: number; readonly cursor: number }[]>([])
  useEffect(() => openSceneKeyLatch(keyLatch), [keyLatch])

  useEffect(() => {
    if (isPaused) {
      keyLatch.clear()
      return
    }
    const drawGate = createGameSceneDrawGate()
    const handle = setGameSceneTickInterval(() => {
      if (releasedRef.current) return
      // 공용 창이 서 있으면 경기 장면 0x52c50 이 52cc6 에서 갱신을 건너뛴다 — 상태 틱이 안 오르고 닫히면 이어 오른다.
      // 커서 · 결과 원 틱은 그리기 0x4d2ac 가 올리는 칸이라 창이 선 첫 그림([창+0x250], 52efe)에만 한 번 더 오른다
      if (isGameSceneFrozen()) {
        keyLatch.clear()
      } else {
        // 키가 먼저다 — 누른 칸 +0x17c8 은 앞 틀 그림까지 오른 커서로 정한다
        runSceneKeys(keyLatch, gameSceneTickNow())
        tickRef.current += 1
        if (isPitchReleaseDue(tickRef.current)) {
          releasedRef.current = true
          onReleaseRef.current(isDecidedCell(pressedRef.current) ? pressedRef.current : 0)
          return
        }
      }
      if (!drawGate.allowsDraw()) return
      // 그리기 0x4d2ac — t 가 0 이면 커서 +1, 서 있으면 결과 원 틱 +1 (0x4d700 · 0x4d708)
      if (isDecidedCell(pressedRef.current)) {
        setResultTick((previous) => previous + 1)
      } else {
        cursorRef.current += 1
        setCursor(cursorRef.current)
        const drawn = drawnCursorsRef.current
        drawn.push({ tick: gameSceneTickNow(), cursor: cursorRef.current })
        if (drawn.length > 32) drawn.splice(0, drawn.length - 32)
      }
    })
    return () => handle()
  }, [isPaused, keyLatch])

  /**
   * 0x50e08 — `seenTick` 은 키를 받은 틱(그때 화면에 있던 그림의 틱). 그 그림의 커서로 칸을 정한다. 그 뒤 그림이 커서를 더 올렸으면
   * (그리기 · 키 손잡이가 밀려 늦게 꺼냄) 원본은 그 그림들에서 이미 커서가 서고 결과 원 틱이 올랐다 — 그만큼 되돌려 맞춘다
   */
  const press = (seenTick: number) => {
    if (releasedRef.current || isPaused || !showsGauge) return
    const drawn = drawnCursorsRef.current
    let seenIndex = -1
    for (let index = drawn.length - 1; index >= 0; index -= 1) {
      if ((drawn[index]?.tick ?? Number.POSITIVE_INFINITY) <= seenTick) {
        seenIndex = index
        break
      }
    }
    const seenCursor = seenIndex < 0 ? (drawn.length === 0 ? cursorRef.current : 0) : drawn[seenIndex]?.cursor ?? cursorRef.current
    const wasDecided = isDecidedCell(pressedRef.current)
    pressedRef.current = gaugePressedCellOf(pressedRef.current, seenCursor)
    setPressed(pressedRef.current)
    if (wasDecided || !isDecidedCell(pressedRef.current)) return
    // 본 그림 뒤에 그린 그림 수 — 원본은 그 그림들이 커서 대신 결과 원 틱 +0x17c4 를 올렸다 (0x4d700 · 0x4d708)
    const laterDraws = drawn.length - 1 - seenIndex
    if (laterDraws > 0) {
      cursorRef.current = seenCursor
      setCursor(seenCursor)
      setResultTick(laterDraws)
    }
  }
  const pressRef = useRef(press)
  pressRef.current = press
  const isPausedRef = useRef(isPaused)
  isPausedRef.current = isPaused

  /** 키 · 누름 하나를 칸에 넣는다 — 받은 틱은 사건이 난 때 화면에 있던 그림의 틱(누름 칸은 닿은 시각 — `PressArea`) */
  const pushPress = (event: Event | undefined) => {
    const inputTime = inputTimeOf(event)
    const seenTick = keyLatch.tickAt(inputTime)
    keyLatch.push(() => pressRef.current(seenTick), 'press', inputTime)
  }
  const pushPressRef = useRef(pushPress)
  pushPressRef.current = pushPress

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isPausedRef.current) return
      const code = originalKeyCodeOf(event.key)
      // 메시지 9 의 0x50dfa — OK(−5) · '5' 만 0x50e08 로 간다
      if (code !== KEY_OK && code !== 0x35) return
      event.preventDefault()
      pushPressRef.current(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [keyLatch])

  // 게이지를 안 쓰는 공 — 0x11 의 10틱만 흘려 보낸다 (그림 없음)
  if (!showsGauge) return null

  const isDecided = isDecidedCell(pressed)
  return (
    <PressLayer testId="게이지 누름 칸">
      <PressArea
        {...(overlay === undefined ? {} : { rect: gaugeTapRectOf(overlay.aim, overlay.aimSide) })}
        label={`투구 게이지 ${isDecided ? pressed : cursor}칸`}
        // 누름 칸도 키와 같은 길 — 손가락 · 마우스가 닿은 시각에 본 그림의 틱(`PressArea` 가 사건에 붙인다, r222)
        onPress={(event) => pushPress(event)}
      />
    </PressLayer>
  )
}
