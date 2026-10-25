import { useEffect, useRef, useState } from 'react'
import { createSceneKeyLatch, isRunningSceneKeys, openSceneKeyLatch, runSceneKeys } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import {
  AIM_STILL,
  aimKeyActionOf,
  aimStartOf,
  aimTickOf,
} from '@/features/play-pitcher-game/model/pitchAim'
import type { AimDirection, AimKeyAction } from '@/features/play-pitcher-game/model/pitchAim'
import { AIM_KEYPAD_KEYS, aimTapRectsOf } from '@/pages/pitching/lib/pitchInputTapZones'
import { CLEAR_PRESS_RECT } from '@/features/play-game/model/stagePressAreas'
import { PressArea } from '@/shared/ui'
import type { TouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { PressLayer } from '@/pages/pitching/ui/PressLayer'
import { usePublishedOverlay } from '@/pages/pitching/model/pitchInputOverlayRef'
import type { PitchInputOverlayRef } from '@/pages/pitching/model/pitchInputOverlayRef'
import {
  createGameSceneDrawGate, gameSceneTickNow, isGameSceneFrozen, setGameSceneTickInterval,
} from '@/shared/lib/commonWindow/commonWindow'
import { subscribeInGameMenuStarOpen } from '@/features/play-team-game/model/useInGameMenuState'

interface AimCursorProps {
  /** 존 중심 표 0xcfbcc 의 칸 — 진행기가 투구에 쓰는 side 와 같다 */
  readonly side: number
  /**
   * 0x10 의 틱 하나 `0x39c5c`. 안 넘기면 걸음 · 자르기만 한다(미션이 아닌 경기 — 난수를 안 쓴다).
   * 투수 미션은 세션이 흔들림(경기 난수)까지 넣은 `aimTickOf` 를 넘긴다.
   */
  readonly onTick?: (aim: WorldPoint, direction: AimDirection) => WorldPoint
  /** OK · '5' (0x50e9c) — 그 틱까지 돈 조준점을 넘긴다 */
  readonly onConfirm: (aim: WorldPoint) => void
  /** CLR (0x50ee0) — 0xf 로 돌아간다. 안 넘기면 CLR 이 방향만 지운다 */
  readonly onCancel?: () => void
  /** 일시정지 팝업(0x741a0)이 떠 있으면 틱도 키도 멈춘다 */
  readonly isPaused?: boolean
  /** 장면 위 조준 그림(0x4d780 — 조준점의 애니 0 · 구질 이름)의 재료를 실을 칸 */
  readonly overlay?: { readonly ref: PitchInputOverlayRef; readonly typeNumber: number }
}

/** 누름 칸 읽기 이름 — 휴대폰 숫자판 그대로 ('5' = OK) */
const KEYPAD_LABELS: Readonly<Record<string, string>> = {
  '1': '↖', '2': '↑', '3': '↗', '4': '←', '5': 'OK', '6': '→', '7': '↙', '8': '↓', '9': '↘',
}

/**
 * **조준 (경기 상태 0x10)** — 원본은 칸을 고르지 않고 **계속 흐르는 조준점**을 움직인다.
 *
 * - 들어설 때 0x39894 가 조준점을 존 중심 표 0xcfbcc[side] 로 놓는다.
 * - 새로 누른 키마다 메시지 8(0x50e3a)이 방향 dx · dy 를 다시 정한다 — 숫자 1~9 · 방향키, 그 밖 키는 멈춤.
 *   **키를 떼도 다른 키를 누를 때까지 흐른다**(뗌은 0x536bc 가 0x10 에 안 넘긴다).
 * - 매 틱 0x39c5c: x · y += 방향 × 20, z −= dy × 10, 존 중심 기준 x ±600 · y ±400 · z ±200 으로 자른다.
 * - OK · '5' 는 확정(0x50e9c → 0x11), CLR 은 0xf 로(0x50ee0). 둘 다 방향을 지운 뒤 그 틱의 0x39c5c 를 한 번 더 지난다.
 *   한 그림 안의 차례는 키가 먼저다(r112 확인): 장면 프레임 0x52c50 이 키 사건 0x498d4 를 52d9e 에서, 갱신 표(0x10 → 0x39c5c)를
 *   52e44~ 에서 부르고, 0x11 예약(0xbcb48)은 다음 그림의 진입 표에서 선다 — 그래서 지운 방향으로 0x39c5c 를 한 번 더 지난 뒤 넘긴다.
 *
 * 원본 조준 그림은 장면 위다 — `overlay` 를 넘기면 장면(`widgets/batting-stage/lib/pitchInputOverlay`)이 조준점의 투영(0xbe3d8,
 * `projectToScreen`) 자리에 slt_pitch 애니 0 을, 존 위에 구질 이름을 그린다. 이 부품은 키 · 틱과, 마우스 길로 조준 영역(자르기
 * 상자의 투영)을 3 × 3 으로 나눈 **투명한 누름 칸**(숫자 1~9, 가운데 = OK)과 CLR 칸만 낸다 (`pitchInputTapZones`).
 */
/** 조준의 CLR — 구질 고르기로 돌아간다 */
const AIM_CANCEL_OFFER: TouchKeyOffer = { key: 'Escape', label: '구질로' }

export function AimCursor({ side, onTick, onConfirm, onCancel, isPaused = false, overlay }: AimCursorProps) {
  const [aim, setAim] = useState<WorldPoint>(() => aimStartOf(side))
  /** 0x10 에 든 뒤 그림 수 — 애니 0 칸 */
  const [drawTick, setDrawTick] = useState(0)
  usePublishedOverlay(
    overlay?.ref,
    overlay === undefined ? null : { kind: '조준', aim, aimSide: side, typeNumber: overlay.typeNumber, tick: drawTick },
  )
  const aimRef = useRef(aim)
  const directionRef = useRef<AimDirection>(AIM_STILL)
  const isDoneRef = useRef(false)
  const propsRef = useRef({ side, onTick, onConfirm, onCancel, isPaused })
  propsRef.current = { side, onTick, onConfirm, onCancel, isPaused }

  const tick = () => {
    const { side: currentSide, onTick: currentOnTick } = propsRef.current
    const next = currentOnTick
      ? currentOnTick(aimRef.current, directionRef.current)
      : aimTickOf(aimRef.current, directionRef.current, currentSide)
    aimRef.current = next
    setAim(next)
  }
  const tickRef = useRef(tick)
  tickRef.current = tick

  /** 받은 키 칸 — 메시지 8 은 받은 다음 틀의 키 0x498d4(52d9e)가 0x10 갱신 0x39c5c(52e14~)보다 먼저 처리한다(`sceneKeyLatch`) */
  const [keyLatch] = useState(createSceneKeyLatch)
  useEffect(() => openSceneKeyLatch(keyLatch), [keyLatch])

  useEffect(() => {
    if (isPaused) {
      keyLatch.clear()
      return
    }
    const drawGate = createGameSceneDrawGate()
    const handle = setGameSceneTickInterval(() => {
      if (isDoneRef.current) return
      // 공용 창이 서 있으면 경기 장면 0x52c50 이 52cc6 에서 갱신(0x39c5c 조준점 이동)을 건너뛴다 — 닫히면 이어 돈다.
      // 애니 0 칸은 그림마다 나가는 그리기 쪽이라 창이 선 첫 그림([창+0x250], 52efe)에만 한 번 더 나간다
      if (isGameSceneFrozen()) {
        keyLatch.clear()
      } else {
        // 키(메시지 8 — 방향 · OK · CLR)가 먼저다. OK · CLR 은 그 안에서 이 틀의 0x39c5c 를 지운 방향으로 한 번 지나고 끝난다
        runSceneKeys(keyLatch, gameSceneTickNow())
        if (isDoneRef.current) return
        tickRef.current()
      }
      if (drawGate.allowsDraw()) setDrawTick((previous) => previous + 1)
    })
    return () => handle()
  }, [isPaused, keyLatch])

  const apply = (action: AimKeyAction) => {
    if (isDoneRef.current || propsRef.current.isPaused) return
    // 메시지 8 머리 — 어느 키든 방향을 먼저 지운다
    directionRef.current = action.kind === 'move' ? action.direction : AIM_STILL
    if (action.kind === 'move') return
    if (action.kind === 'cancel' && propsRef.current.onCancel === undefined) return
    isDoneRef.current = true
    tickRef.current()
    if (action.kind === 'confirm') propsRef.current.onConfirm(aimRef.current)
    else propsRef.current.onCancel?.()
  }
  const applyRef = useRef(apply)
  applyRef.current = apply

  // '*'(소프트키1 · "*MENU" 누름 칸도) — 공용 키 0x498d4 가 메뉴를 세운 뒤 같은 키로 메시지 8 을 보내 dx · dy 를 지우고(499fa →
  // 0x534b0 → 0x50e3a), 그 그림의 갱신 0x39c5c 가 게이트(52cc6, 키 앞) 뒤라 한 번 더 돈다. 다음 그림부터는 창이 멈춘다.
  // '*' 가 키 칸으로 들어 이 틀의 키 자리에서 열렸으면(`isRunningSceneKeys`) 그 갱신은 위 틀이 뒤이어 돌린다 — 방향만 지운다
  useEffect(
    () =>
      subscribeInGameMenuStarOpen(() => {
        if (isDoneRef.current || propsRef.current.isPaused || isGameSceneFrozen()) return
        directionRef.current = AIM_STILL
        if (!isRunningSceneKeys()) tickRef.current()
      }),
    [],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 누르고 있는 반복 · 뗌은 0x10 에 안 온다 (0x536bc 의 [+0x1c] == 0 만)
      if (event.repeat || propsRef.current.isPaused) return
      const action = aimKeyActionOf(event.key)
      if (action === null) return
      event.preventDefault()
      keyLatch.push(() => applyRef.current(action))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [keyLatch])

  const pressKey = (key: string) => {
    const action = aimKeyActionOf(key)
    if (action !== null) keyLatch.push(() => applyRef.current(action))
  }
  const rects = aimTapRectsOf(side)

  return (
    <PressLayer testId="조준 영역">
      {/* 조준점 값 — 그림은 장면이 그린다. 시험 · 읽기 보조용 */}
      <span hidden data-testid="조준점" data-x={aim.x} data-y={aim.y} data-z={aim.z} />
      {AIM_KEYPAD_KEYS.map((key, index) => (
        <PressArea
          key={key}
          rect={rects[index]}
          label={key === '5' ? '조준 확정' : `조준 ${KEYPAD_LABELS[key] ?? key}`}
          onPress={() => pressKey(key)}
        />
      ))}
      {onCancel !== undefined && (
        // 조준(0x10)은 "#TIME" 도 CLR 글자도 안 그린다 — 투명 칸이라 터치 기기에는 상황 버튼도 낸다(r194, 키 CLR 과 같은 길)
        <PressArea rect={CLEAR_PRESS_RECT} label="CLR 구질로" touchKey={AIM_CANCEL_OFFER} onPress={() => pressKey('Escape')} />
      )}
    </PressLayer>
  )
}
