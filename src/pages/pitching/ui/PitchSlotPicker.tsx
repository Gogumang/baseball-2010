import { useEffect, useRef, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { isPitchSelectionDue, pitchSlotOfKey } from '@/features/play-pitcher-game/model/pitchAim'
import { slotTapRectOf } from '@/pages/pitching/lib/pitchInputTapZones'
import { TapLayer, TapZone } from '@/pages/pitching/ui/TapZone'
import type { PitchInputOverlay } from '@/widgets/batting-stage/lib/pitchInputOverlay'
import { usePublishedOverlay } from '@/pages/pitching/model/pitchInputOverlayRef'
import type { PitchInputOverlayRef } from '@/pages/pitching/model/pitchInputOverlayRef'

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

/** 칸 → 키 (0x534d8) — 누름 칸 읽기 이름 */
const SLOT_KEY_LABELS = ['OK', '2', '4', '6', '8', '0']

/**
 * **구질 고르기 (경기 상태 0xf)** — 원본은 커서 메뉴가 아니라 **칸마다 키가 정해져 있다** (0x534d8 → 메시지 7 → 0x50da8):
 * OK · '5' → 칸 0, '2' · 위 → 1, '4' · 왼 → 2, '6' · 오른 → 3, '8' · 아래 → 4, '0' → 5(마구).
 *
 * - 0x50da8 은 칸의 구질을 `+0xfc8` 에 적기만 한다 — 남은 마구가 0 이면 마구 칸 키를 버린다(0x50db8).
 * - 넘김은 0xf 의 틱 `0x39c1c` 몫이다: 상태 틱이 7 을 넘고 구질이 정해졌을 때만 0x10 — 그 전에 누른 키는
 *   칸만 바꿔 적는다(마지막 키가 이긴다). 0xf 진입 0x3d954 가 `+0xfc8` 을 0 으로 지우므로 들어설 때마다 처음부터다.
 * - ⚠️ 미이식: 빈 칸(구질 0)의 키는 0x50de8 에서 투수 그림 객체(+0xf98)에 0x9dff8(…, 2)를 건다 — 상태 +0x14 = 2 · 단계 · 틱 0
 *   (0x9dff8~0x9e000)이라 그 투수가 대기 동작(표 0xd73e4 · 프레임 0,19,0,19 — 0x9df8c 가 단계 3 을 넘으면 상태 0)을 **한 바퀴**
 *   한다. 장면(`PitcherSideStage`)이 투수를 그리지만 지금 웹 대기 그림은 그 한 바퀴를 늘 되풀이해 그린다
 *   (`stageScenery.pitcherIdleFrameAt` — 상태 0 의 선 자세와 갈리지 않는다). 장면이 투수 상태 0 · 2 를 가르면 이 키에서 이을 수 있다.
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
  usePublishedOverlay(
    overlay?.ref,
    overlay === undefined
      ? null
      : ({ kind: '구질', typeNumbers: overlay.typeNumbers, magicRemaining: overlay.magicRemaining, tick } satisfies PitchInputOverlay),
  )
  /** 고른 칸 (`+0xfc8` 이 서 있는 자리) */
  const [chosen, setChosen] = useState<number | null>(null)
  const chosenRef = useRef<number | null>(null)
  const isDoneRef = useRef(false)
  const propsRef = useRef({ choices, onDecide, isPaused })
  propsRef.current = { choices, onDecide, isPaused }

  useEffect(() => {
    if (isPaused) return
    const handle = window.setInterval(() => {
      if (isDoneRef.current) return
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
    // 빈 칸 · 막힌 마구 칸 — `+0xfc8` 이 그대로다
    if (choice === undefined || choice.isBlocked === true) return
    chosenRef.current = slot
    setChosen(slot)
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
    <TapLayer testId="구질 누름 칸">
      {choices.map((choice) => {
        const rect = slotTapRectOf(choice.slot, stageSide)
        if (rect === null) return null
        return (
          <TapZone
            key={choice.slot}
            rect={rect}
            label={`${SLOT_KEY_LABELS[choice.slot] ?? ''} ${choice.name}`}
            isPressed={choice.slot === chosen}
            isDisabled={choice.isBlocked === true}
            onPress={() => press(choice.slot)}
          />
        )
      })}
    </TapLayer>
  )
}
