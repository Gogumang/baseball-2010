// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, renderHook } from '@testing-library/react'
import { useStageControls } from '@/widgets/batting-stage/model/useStageControls'
import type { StageActions } from '@/widgets/batting-stage/model/useStageControls'
import type { StageRefs } from '@/widgets/batting-stage/model/stageRefs'
import {
  markCommonWindowShown,
  markGameSceneUp,
  resetCommonWindowShownForTest,
} from '@/shared/lib/commonWindow/commonWindow'
import { createSceneKeyLatch, runSceneKeys } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'

afterEach(cleanup)

/** 받은 키 칸 — 루프(`useStageAnimation`)가 다음 틀의 키 자리에서 꺼낸다 */
let 칸 = createSceneKeyLatch()
/** 다음 틀 — 칸에 든 키를 처리한다 */
const 다음틀 = () => runSceneKeys(칸, Number.POSITIVE_INFINITY)

/** 이 고리가 실제로 읽는 칸만 채운 가짜 ref 묶음 */
const 가짜refs = (canBunt: boolean): StageRefs =>
  ({
    pointerDownAtRef: { current: 0 },
    latestRef: { current: { canBunt } },
    keyLatch: 칸,
  }) as unknown as StageRefs

const 붙이기 = (actions: Partial<StageActions>, canBunt = true) => 붙이기와손(actions, canBunt).손잡이

const 붙이기와손 = (actions: Partial<StageActions>, canBunt = true) => {
  const 손잡이: StageActions = {
    swing: vi.fn(),
    pressBunt: vi.fn(),
    releaseBunt: vi.fn(),
    moveBatter: vi.fn(),
    ...actions,
  }
  칸 = createSceneKeyLatch()
  const refs = 가짜refs(canBunt)
  const { result } = renderHook(() => useStageControls(refs, 손잡이))
  return { 손잡이, 손: result.current }
}

describe('키 사건 0xbca05 — 받은 키는 다음 틀의 키 0x498d4(52d9e)가 처리한다', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resetCommonWindowShownForTest()
  })

  it('받은 틱에는 아무 일도 없고 다음 틱 머리에서 처리한다 — 좌우 이동도 그 자리에서 바뀌지 않는다', () => {
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(1000) // 틱 16
    const 손잡이 = 붙이기({})
    fireEvent.keyDown(window, { key: '4' })
    expect(손잡이.moveBatter).not.toHaveBeenCalled()
    // 같은 틱의 틀은 꺼내지 않는다
    runSceneKeys(칸, 16)
    expect(손잡이.moveBatter).not.toHaveBeenCalled()
    runSceneKeys(칸, 17)
    expect(손잡이.moveBatter).toHaveBeenCalledWith(-1)
    now.mockReturnValue(1070) // 틱 17
    fireEvent.keyDown(window, { key: '5' })
    runSceneKeys(칸, 18)
    // 스윙은 받은 틱으로 센다(`keyTickOf` — 보이던 공 틱 + 1)
    expect(손잡이.swing).toHaveBeenCalledWith(17)
  })

  it('받은 칸 [+0x20] 은 하나다 — 한 틀에 키가 둘 오면 뒤 키만 남는다(누름 0x39f4c 는 덮어쓰기만)', () => {
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(1000) // 틱 16
    const 손잡이 = 붙이기({})
    fireEvent.keyDown(window, { key: '4' })
    fireEvent.keyDown(window, { key: '5' })
    runSceneKeys(칸, 17)
    expect(손잡이.moveBatter).not.toHaveBeenCalled()
    expect(손잡이.swing).toHaveBeenCalledWith(16)
  })
})

describe('타석 키 배치 (0x53670 · 0x535a4)', () => {
  it("'0' 이 필살타법을 부른다 (메시지 0x6a6)", () => {
    const specialSwing = vi.fn()
    붙이기({ specialSwing })

    fireEvent.keyDown(window, { key: '0' })
    다음틀()

    expect(specialSwing).toHaveBeenCalledTimes(1)
  })

  it("'0' 은 스윙도 번트도 아니다", () => {
    const 손잡이 = 붙이기({ specialSwing: vi.fn() })

    fireEvent.keyDown(window, { key: '0' })
    다음틀()

    expect(손잡이.swing).not.toHaveBeenCalled()
    expect(손잡이.pressBunt).not.toHaveBeenCalled()
  })

  it('화면이 필살타법 손잡이를 안 넘기면 아무 일도 없다', () => {
    const 손잡이 = 붙이기({})

    fireEvent.keyDown(window, { key: '0' })

    expect(손잡이.swing).not.toHaveBeenCalled()
    expect(손잡이.pressBunt).not.toHaveBeenCalled()
  })

  it('나머지 키는 그대로다 — 5 스윙 · 4/6 이동 · 8 번트', () => {
    const 손잡이 = 붙이기({ specialSwing: vi.fn() })

    // 한 틀에 하나씩 — 같은 틀에 둘이면 뒤 키만 남는다
    for (const key of ['5', '4', '6', '8']) {
      fireEvent.keyDown(window, { key })
      다음틀()
    }

    expect(손잡이.swing).toHaveBeenCalledTimes(1)
    expect(손잡이.moveBatter).toHaveBeenNthCalledWith(1, -1)
    expect(손잡이.moveBatter).toHaveBeenNthCalledWith(2, 1)
    expect(손잡이.pressBunt).toHaveBeenCalledTimes(1)
  })
})

describe('번트는 누르고 있는 동안만 — 뗄 때 0x5364c → 0x6a8 (0xbca04 비트 9)', () => {
  it("'7'~'9' 를 떼면 푼다 — 종류를 가리지 않는다", () => {
    const 손잡이 = 붙이기({})

    fireEvent.keyDown(window, { key: '7' })
    다음틀()
    expect(손잡이.pressBunt).toHaveBeenCalledWith(2, expect.any(Number))
    fireEvent.keyUp(window, { key: '9' })
    다음틀()
    expect(손잡이.releaseBunt).toHaveBeenCalledTimes(1)
  })

  it('번트 키를 다시 눌러도 끄지 않는다 — 누름은 늘 누름이다', () => {
    const 손잡이 = 붙이기({})

    fireEvent.keyDown(window, { key: '8' })
    다음틀()
    fireEvent.keyDown(window, { key: '8' })
    다음틀()
    expect(손잡이.pressBunt).toHaveBeenCalledTimes(2)
    expect(손잡이.releaseBunt).not.toHaveBeenCalled()
  })

  it('다른 키를 떼면 아무 일도 없다', () => {
    const 손잡이 = 붙이기({})

    fireEvent.keyUp(window, { key: '5' })
    다음틀()
    expect(손잡이.releaseBunt).not.toHaveBeenCalled()
  })
})

describe('공용 창이 서 있는 동안 (경기 장면 0x52c50 의 52cc6 — 키 처리 0x498d4 를 건너뛴다)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resetCommonWindowShownForTest()
  })

  it('경기 장면 위에 창이 떠 있으면 스윙 · 이동 · 번트 키를 안 받는다', () => {
    const 장면 = markGameSceneUp()
    const 창 = markCommonWindowShown()
    const 손잡이 = 붙이기({ specialSwing: vi.fn() })

    for (const key of ['5', '4', '6', '8', '0']) fireEvent.keyDown(window, { key })
    다음틀()

    expect(손잡이.swing).not.toHaveBeenCalled()
    expect(손잡이.moveBatter).not.toHaveBeenCalled()
    expect(손잡이.pressBunt).not.toHaveBeenCalled()
    expect(손잡이.specialSwing).not.toHaveBeenCalled()
    창()
    fireEvent.keyDown(window, { key: '5' })
    다음틀()
    expect(손잡이.swing).toHaveBeenCalledTimes(1)
    장면()
  })

  it("창이 떠 있는 동안 뗀 '7'~'9' 는 버려진다 — 사건은 그 프레임 0xbca05 만 들고 0x498d4(52d9e)는 게이트 뒤라, 닫혀도 자세가 남는다", () => {
    const 장면 = markGameSceneUp()
    const 손잡이 = 붙이기({})
    fireEvent.keyDown(window, { key: '8' })
    다음틀()
    expect(손잡이.pressBunt).toHaveBeenCalledTimes(1)
    const 창 = markCommonWindowShown()
    fireEvent.keyUp(window, { key: '8' })
    창()
    다음틀()
    expect(손잡이.releaseBunt).not.toHaveBeenCalled()
    // 닫힌 뒤 다시 누르고 떼야 푼다
    fireEvent.keyDown(window, { key: '8' })
    fireEvent.keyUp(window, { key: '8' })
    다음틀()
    expect(손잡이.releaseBunt).toHaveBeenCalledTimes(1)
    장면()
  })

  it('창이 닫힌 뒤 키 틱은 경기 장면 틱이다 — 창이 떠 있던 만큼 빠진다(단계 시작 틱과 같은 격자)', () => {
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(1000)
    const 장면 = markGameSceneUp()
    const 창 = markCommonWindowShown()
    now.mockReturnValue(4000)
    창()
    now.mockReturnValue(4500)
    const 손잡이 = 붙이기({})
    fireEvent.keyDown(window, { key: '5' })
    다음틀()
    // 장면 시각 1500ms(창이 떠 있던 3000ms 를 뺐다) → 62ms 틱 격자의 24 번 틱
    expect(손잡이.swing).toHaveBeenCalledWith(24)
    장면()
  })
})

describe('화면 탭 (웹판 추가) — 손가락이 닿는 순간 키 하나', () => {
  /** 캔버스 240 폭에 x 를 누른 사건 */
  const 누름 = (x: number, button = 0) => {
    const canvas = document.createElement('canvas')
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 240, height: 320, right: 240, bottom: 320, x: 0, y: 0, toJSON: () => ({}) })
    return { currentTarget: canvas, clientX: x, clientY: 160, button, preventDefault: () => {} } as unknown as Parameters<ReturnType<typeof useStageControls>['onPointerDown']>[0]
  }

  it('가운데는 누르는 순간 스윙(OK) — 떼기를 기다리지 않는다, 처리는 다음 틀', () => {
    const { 손잡이, 손 } = 붙이기와손({})
    손.onPointerDown(누름(120))
    expect(손잡이.swing).not.toHaveBeenCalled()
    다음틀()
    expect(손잡이.swing).toHaveBeenCalledTimes(1)
    expect(손잡이.pressBunt).not.toHaveBeenCalled()
  })

  it("양 끝은 '4'/'6' 타자 이동 · 오른쪽 단추는 아무 일도 없다", () => {
    const { 손잡이, 손 } = 붙이기와손({})
    손.onPointerDown(누름(10))
    다음틀()
    손.onPointerDown(누름(230))
    다음틀()
    손.onPointerDown(누름(120, 2))
    다음틀()
    expect(손잡이.moveBatter).toHaveBeenNthCalledWith(1, -1)
    expect(손잡이.moveBatter).toHaveBeenNthCalledWith(2, 1)
    expect(손잡이.swing).not.toHaveBeenCalled()
  })
})
