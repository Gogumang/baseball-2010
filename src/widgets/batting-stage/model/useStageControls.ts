import { useEffect } from 'react'
import type { PointerEvent } from 'react'
import type { SceneKeyKind } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { STAGE_WIDTH } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { StageRefs } from '@/widgets/batting-stage/model/stageRefs'
import { gameSceneNow, gameSceneTickNow, isGameSceneFrozen } from '@/shared/lib/commonWindow/commonWindow'

/** 화면 좌우 이 비율 안쪽을 누르면 타자를 옮긴다 (모바일용, 웹판 추가) */
const SHIFT_EDGE_RATIO = 0.25

export interface StageActions {
  /** 스윙 키 — `tick` 은 키를 받은 경기 장면 틱(`gameSceneTickNow`) */
  readonly swing: (tick: number) => void
  /** 번트 키 누름 — 0x6a7 (`BattingStage` 의 `pressBunt`) */
  readonly pressBunt: (kind: number, tick: number) => void
  /** 번트 키 뗌 — 0x6a8 (`BattingStage` 의 `releaseBunt`). 번트는 누르고 있는 동안만이다 */
  readonly releaseBunt: (tick: number) => void
  readonly moveBatter: (direction: -1 | 1) => void
  /**
   * **필살타법** — 원본 `0x535a4` 의 '0' 가지(메시지 **0x6a6**, I-controls 0절). 거는 단계 없이
   * **그 자리에서 필살 스윙**이 나간다 (0x51dee — 일반 스윙 0x51db6 과 같은 예약, S+0x10 만 다르다).
   *
   * 성공하면 그 타구에 "송구공" 비트가 붙어 **야수가 잡지 못한다** (0x51800, S13 6절 확정) —
   * 판정 쪽은 `features/defense-play` 의 `isUncatchable` 이 이미 받아 준다.
   *
   * 이 고리는 **키만** 받는다. 남은 횟수 가드(0x51e14)·소모(0x4e136)·성공 굴림(0x34c74 — 번호별
   * 15·20·25·25%, 마타자 30%)은 `widgets/batting-stage/ui/BattingStage` 가 맡는다.
   * 안 넘기면 '0' 키는 아무 일도 하지 않는다.
   */
  readonly specialSwing?: (tick: number) => void
}

/**
 * 원본 키 배치 (0x53670): OK·5 스윙 · 4/← 6/→ 타자 이동 · 8/7/9 번트 종류 1/2/3 · **'0' 필살타법**(0x535a4 → 메시지 0x6a6).
 * 번트는 **누르고 있는 동안만** 자세다 — 키 사건 +0x1c 비트 9(뗌, 0xbca04)면 0x53670 이 0x5364c 로 '7'~'9' 를 0x6a8 로 보내
 * 자세를 푼다(0x51eba). 다시 눌러 끄는 토글이 아니다.
 * Shift 는 번트 1('8')을 누르는 웹판 편의 키다 — 뗄 때도 '8' 처럼 푼다.
 */
const BUNT_KEYS: Readonly<Record<string, number>> = { '8': 1, '7': 2, '9': 3, Shift: 1 }
const SWING_KEYS: ReadonlySet<string> = new Set([' ', 'Enter', '5'])
const LEFT_KEYS: ReadonlySet<string> = new Set(['ArrowLeft', '4'])
const RIGHT_KEYS: ReadonlySet<string> = new Set(['ArrowRight', '6'])
/** 필살타법 (0x535a4 의 '0' → 0x6a6) */
const SPECIAL_SWING_KEY = '0'

export function useStageControls(refs: StageRefs, actions: StageActions) {
  const { pointerDownAtRef, latestRef, keyLatch } = refs

  /**
   * 키는 받은 그 자리에서 처리하지 않고 키 칸(`keyLatch`)에 든다 — 원본은 키 콜백이 [+0x20] 에 적기만 하고 다음 틀의 0xbca05 →
   * 키 0x498d4(52d9e)가 진입(52cdc) 뒤 · 갱신(52e14) 앞에서 처리한다. 루프(`useStageAnimation`)가 그 자리에서 꺼낸다.
   * 각 동작은 받은 장면 틱 `tick` 을 받는다 — 스윙 예약의 공 틱(`keyTickOf` = 보이던 공 틱 + 1)은 그 틱으로 센다.
   */
  const latch = (apply: (tick: number) => void, kind: SceneKeyKind = 'press') => {
    const tick = gameSceneTickNow()
    keyLatch.push(() => apply(tick), kind)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      // 공용 창이 서 있으면 경기 장면 0x52c50 이 52cc6 에서 키 처리 0x498d4 를 건너뛴다 — 키는 창(0x754f9)이 가져간다.
      // 때는 경기 장면 틱(`gameSceneTickNow`)으로 잰다 — 단계 시작 틱과 같은 격자라야 키 틱이 맞는다
      if (isGameSceneFrozen()) return
      if (SWING_KEYS.has(event.key)) {
        event.preventDefault()
        latch((tick) => actions.swing(tick))
      } else if (event.key === SPECIAL_SWING_KEY) {
        // 필살타법 — 화면이 손잡이를 안 넘겼으면 원본 키만 받아 두고 아무 일도 하지 않는다
        if (actions.specialSwing === undefined) return
        event.preventDefault()
        const { specialSwing } = actions
        latch((tick) => specialSwing(tick))
      } else if (LEFT_KEYS.has(event.key)) {
        event.preventDefault()
        // 좌우 이동 0x53470 → 0x6a4 → 0x50f86 은 키 처리 안에서 +0xfe4 를 바로 고친다 — 다음 틀의 키 자리에서 바뀌고 그 틀부터 그린다
        latch(() => actions.moveBatter(-1))
      } else if (RIGHT_KEYS.has(event.key)) {
        event.preventDefault()
        latch(() => actions.moveBatter(1))
      } else if (BUNT_KEYS[event.key] !== undefined && latestRef.current.canBunt) {
        const kind = BUNT_KEYS[event.key]
        latch((tick) => actions.pressBunt(kind, tick))
      }
    }
    // 0x5364c — 뗀 키가 '7'~'9' 면 0x6a8 (종류를 가리지 않는다).
    // 창이 서 있는 동안 뗀 키는 버려진다 (2026-10-16 직접 떴다): 키 사건은 프레임마다 0x52c50 52cbc 의 0xbca05 가 만든다 —
    // 머리 bca0a~bca16 이 +0x1c · 사건 비트 +0x54 · 뗀 키 +0x3c 를 0 으로 지우고, 뗀 키 [+0x24] 가 있으면 bcaf0~bcb02 가 +0x54 |= 0x200
    // (뗌) · +0x3c = 그 키 · 누름 +0x48 = 0 을 적은 뒤 bcb04~bcb08 이 받은 칸 [+0x20] · [+0x24] 를 비운다. 이 사건을 읽는 키 0x498d4 는
    // 52cc6 게이트 **뒤**(52d9e)라 창이 서 있으면 안 불리고, 다음 프레임 0xbca05 가 사건을 지운다 — 모아 두는 칸이 없다.
    // 그래서 창 아래에서 번트 키를 떼면 0x6a8 이 안 가고, 창이 닫힌 뒤에도 자세(+0xfdc)가 남는다(원본 그대로)
    const onKeyUp = (event: KeyboardEvent) => {
      if (BUNT_KEYS[event.key] === undefined || isGameSceneFrozen()) return
      // 뗌 [+0x24] 도 다음 틀의 0xbca05(bcaf0~) → 0x5364c 가 읽는다 — 뗌 칸도 하나라 한 틀의 마지막 뗌만, 누름 뒤에 처리된다
      latch((tick) => actions.releaseBunt(tick), 'release')
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 칸(`keyLatch`)은 부품마다 하나다
  }, [actions])

  return {
    /**
     * 화면 탭 (웹판 추가 — 원본은 키뿐). **손가락이 닿는 순간** 키를 받는다(떼는 순간이 아니다 — 키패드 키도 누름에 keydown 이다).
     * 가운데 = OK 스윙, 양 끝(`SHIFT_EDGE_RATIO`) = '4'/'6' 타자 이동. 번트('8', 누르고 있는 동안)는 터치 상황 버튼 · 키로 한다
     * (r173 — 예전에는 길게 누르면 번트라 스윙이 손을 뗄 때 나가 한두 틀 늦었다).
     */
    onPointerDown: (event: PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault()
      pointerDownAtRef.current = gameSceneNow()
      // 주 단추(터치 · 펜 · 마우스 왼쪽)만
      if (event.button > 0) return
      // 공용 창이 서 있으면 키 처리 0x498d4 가 없다(52cc6) — 위 `onKeyDown` 과 같다
      if (isGameSceneFrozen()) return
      const bounds = event.currentTarget.getBoundingClientRect()
      const x = ((event.clientX - bounds.left) / bounds.width) * STAGE_WIDTH
      if (x < STAGE_WIDTH * SHIFT_EDGE_RATIO) return latch(() => actions.moveBatter(-1))
      if (x > STAGE_WIDTH * (1 - SHIFT_EDGE_RATIO)) return latch(() => actions.moveBatter(1))
      latch((tick) => actions.swing(tick))
    },
  }
}
