import { useEffect, useRef, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { isPitchSelectionDue, pitchSlotOfKey } from '@/features/play-pitcher-game/model/pitchAim'
import { slotTapRectOf } from '@/pages/pitching/lib/pitchInputTapZones'
import { PressArea } from '@/shared/ui'
import { PressLayer } from '@/pages/pitching/ui/PressLayer'
import type { PitchInputOverlay } from '@/widgets/batting-stage/lib/pitchInputOverlay'
import { usePublishedOverlay } from '@/pages/pitching/model/pitchInputOverlayRef'
import type { PitchInputOverlayRef } from '@/pages/pitching/model/pitchInputOverlayRef'
import { isGameSceneFrozen } from '@/shared/lib/commonWindow/commonWindow'

/** 구질 칸 하나 — 칸 번호는 0xb6d2c 의 칸 0~5 (5 = 마구) */
export interface PitchSlotChoice {
  readonly slot: number
  readonly name: string
  readonly detail?: string
  /** 고를 수 없다 — 마구 칸인데 남은 횟수가 0 (0x50db8 이 키를 버린다) */
  readonly isBlocked?: boolean
}

interface PitchSlotPickerProps {
  /** 빈 칸(구질 0)은 빼고 넘긴다 */
  readonly choices: readonly PitchSlotChoice[]
  /** 0xf → 0x10 — 틱 8 이 지나고 칸이 정해진 그 틱에 한 번 불린다 (`0x39c1c`) */
  readonly onDecide: (slot: number) => void
  /** 일시정지 팝업(0x741a0)이 떠 있으면 틱도 키도 멈춘다 */
  readonly isPaused?: boolean
  /**
   * 장면 위 구질 목록(0x4c4bc 4c528~)의 재료를 실을 칸 — 칸 0..5 의 구질 번호(+0xfac)와 남은 마구(0xaea11).
   * 장면(`PitcherSideStage`)이 그림마다 읽는다. 안 넘기면 싣지 않는다
   */
  readonly overlay?: { readonly ref: PitchInputOverlayRef; readonly typeNumbers: readonly number[]; readonly magicRemaining: number }
  /**
   * 장면 배치 — 타자 손(0 우타 · 1 좌타, 0xb63c0). 구질 목록은 투수 앵커 0xcfb18[이 값] 둘레에 그려지므로 누름 칸도 그 자리다.
   * 기본 1(좌타)
   */
  readonly stageSide?: number
}

/** 빈 칸 키 표지의 차례 — 화면이 다시 서도 겹치지 않게 모듈에서 센다 */
let idlePressSerial = 0

/** 칸 → 키 (0x534d8) — 누름 칸 읽기 이름 */
const SLOT_KEY_LABELS = ['OK', '2', '4', '6', '8', '0']

/**
 * **구질 고르기 (경기 상태 0xf)** — 원본은 커서 메뉴가 아니라 **칸마다 키가 정해져 있다** (0x534d8 → 메시지 7 → 0x50da8):
 * OK · '5' → 칸 0, '2' · 위 → 1, '4' · 왼 → 2, '6' · 오른 → 3, '8' · 아래 → 4, '0' → 5(마구).
 *
 * - 0x50da8 은 칸의 구질을 `+0xfc8` 에 적기만 한다 — 남은 마구가 0 이면 마구 칸 키를 버린다(0x50db8).
 * - 넘김은 0xf 의 틱 `0x39c1c` 몫이다: 상태 틱이 7 을 넘고 구질이 정해졌을 때만 0x10 — 그 전에 누른 키는
 *   칸만 바꿔 적는다(마지막 키가 이긴다). 0xf 진입 0x3d954 가 `+0xfc8` 을 0 으로 지우므로 들어설 때마다 처음부터다.
 * - 빈 칸(구질 0)의 키는 0x50da8 50db6 `beq 0x50de8` 로 가 투수 그림 객체(+0xf98)에 0x9dff8(…, 2)를 건다 — 상태 +0x14 = 2 ·
 *   단계 · 틱 0 이라 그 투수가 대기 동작(유지 0xd73e4 · 프레임 0xd7454 = 0,19,0,19 — 0x9e004 가 단계 3 을 넘으면 상태 0)을
 *   **한 바퀴** 하고 선 자세로 돌아온다. `+0xfc8` 은 그대로다. 누를 때마다 처음부터 다시 한다.
 *   장면(`PitcherSideStage`)은 구질 목록 그림 재료의 `pitcherIdlePress` 가 바뀐 틱부터 상태 2 를 센다(`stageScenery.pitcherAnimationAt`).
 *   0x9e004 는 0xf 갱신 0x39c1c 에서만 불리므로 한 바퀴가 끝나기 전에 0x10 으로 가면 그 단계에 굳는다(다음 0x11 진입이 덮는다).
 *
 * 견제 '3' · '1' · '7'(0x53548)은 같은 상태의 다른 키라 부르는 쪽이 따로 받는다.
 *
 * 그림(구질 목록 0x4c4bc 4c528~)은 장면이 그린다 — 이 부품은 키 · 틱과, 마우스 길로 그 그림 칸 자리의 **투명한 누름 칸**만 낸다
 * (`pitchInputTapZones`). 누름 칸은 가장 가까운 장면 판(240×320, `position: relative`)에 붙는다.
 */
export function PitchSlotPicker({ choices, onDecide, isPaused = false, overlay, stageSide = 1 }: PitchSlotPickerProps) {
  /** 0xf 상태 틱 `[+0x2c]` */
  const tickRef = useRef(0)
  const [tick, setTick] = useState(0)
  /** 빈 칸 키를 누른 차례 표지 (0 = 안 누름) — `PitchMenuOverlay.pitcherIdlePress` */
  const [idlePress, setIdlePress] = useState(0)
  usePublishedOverlay(
    overlay?.ref,
    overlay === undefined
      ? null
      : ({
          kind: '구질',
          typeNumbers: overlay.typeNumbers,
          magicRemaining: overlay.magicRemaining,
          tick,
          pitcherIdlePress: idlePress,
        } satisfies PitchInputOverlay),
  )
  /** 고른 칸 (`+0xfc8` 이 서 있는 자리) */
  const chosenRef = useRef<number | null>(null)
  const isDoneRef = useRef(false)
  const propsRef = useRef({ choices, onDecide, isPaused })
  propsRef.current = { choices, onDecide, isPaused }

  useEffect(() => {
    if (isPaused) return
    const handle = window.setInterval(() => {
      if (isDoneRef.current) return
      // 공용 창이 서 있으면 경기 장면 0x52c50 이 52cc6 에서 갱신을 건너뛴다 — 이 틱도 안 오르고 닫히면 이어 오른다
      if (isGameSceneFrozen()) return
      tickRef.current += 1
      setTick(tickRef.current)
      if (!isPitchSelectionDue(tickRef.current, chosenRef.current)) return
      isDoneRef.current = true
      propsRef.current.onDecide(chosenRef.current as number)
    }, millisecondsPerFrame())
    return () => window.clearInterval(handle)
  }, [isPaused])

  const press = (slot: number) => {
    if (isDoneRef.current || propsRef.current.isPaused) return
    const choice = propsRef.current.choices.find((candidate) => candidate.slot === slot)
    // 빈 칸(구질 0, `choices` 에 없다) — 0x50de8: 투수 그림 객체에 상태 2(대기 동작 한 바퀴)를 건다. `+0xfc8` 은 그대로다
    if (choice === undefined) {
      idlePressSerial += 1
      setIdlePress(idlePressSerial)
      return
    }
    // 막힌 마구 칸 — 0x50db8 이 키를 버린다. `+0xfc8` 이 그대로다
    if (choice.isBlocked === true) return
    chosenRef.current = slot
  }
  const pressRef = useRef(press)
  pressRef.current = press

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 누르고 있는 반복은 0xf 에 안 온다 (0x536bc 의 [+0x1c] == 0 만)
      if (event.repeat || propsRef.current.isPaused) return
      const slot = pitchSlotOfKey(event.key)
      if (slot === null) return
      event.preventDefault()
      pressRef.current(slot)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <PressLayer testId="구질 누름 칸">
      {choices.map((choice) => {
        const rect = slotTapRectOf(choice.slot, stageSide)
        if (rect === null) return null
        return (
          <PressArea
            key={choice.slot}
            rect={rect}
            label={`${SLOT_KEY_LABELS[choice.slot] ?? ''} ${choice.name}`}
            isDisabled={choice.isBlocked === true}
            onPress={() => press(choice.slot)}
          />
        )
      })}
    </PressLayer>
  )
}
