// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { SCENE_CONFIRM_READY_FRAMES, SCENE_PREPARE_FRAMES } from '@/features/play-game/model/useSceneConfirm'
import { enterSceneConfirm } from '@/features/play-game/model/sceneConfirm'
import { PitchingScreen } from '@/pages/pitching/ui/PitchingScreen'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import type { PitchTypeInfo } from '@/shared/config/original/pitchTypes'
import { PITCHER_MISSIONS } from '@/entities/mission/model/missionGoal'
import { startPitcherMission } from '@/entities/mission/model/pitcherRun'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { liveGameInningIndex, setLiveGameInningIndex } from '@/shared/lib/liveGameState/liveGameState'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** 경기 장면 틱 n 개를 흘린다 */
const 틱 = (n: number) => act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * n))

/** 미션 메뉴의 마구 칸처럼 구속·변화 0 인 항목 (`modePitchMenuOf` 와 같은 모양) */
const 마구칸: PitchTypeInfo = { name: '스카이 포크 (남은 0회)', horizontalBreak: 0, verticalBreak: 0, speed: 0, flightSteps: [] }
const 직구 = PITCH_TYPES[0]!

function 띄우기(magicRemaining: number | undefined) {
  vi.useFakeTimers()
  const onThrow = vi.fn()
  render(
    <PitchingScreen
      run={startPitcherMission(PITCHER_MISSIONS[0]!)}
      repertoire={[직구, 마구칸]}
      usesGauge={false}
      atBat={createAtBat()}
      bannerText=""
      magicRemaining={magicRemaining}
      isMagicType={(type) => type === 마구칸}
      onThrow={onThrow}
      onGiveUp={() => {}}
      onFinish={() => {}}
    />,
  )
  return onThrow
}

describe('미션 준비 0xaa57c — 전역 경기 상태 +0x6b', () => {
  it('0 을 둔 뒤 곧바로 시작 이닝 인덱스(레코드 +3 아래 4비트)를 쓴다 (0xaa5fc · 0xaa698)', () => {
    setLiveGameInningIndex(12)
    띄우기(undefined)

    expect(liveGameInningIndex()).toBe(PITCHER_MISSIONS[0]!.start.inning - 1)
  })
})

describe('투수 미션 투구 화면의 마구 칸 (0x50db8)', () => {
  it('남은 횟수가 0 이면 마구 칸을 골라도 구질 단계에 그대로 머문다 — 키가 버려진다', () => {
    띄우기(0)
    expect(screen.getByText(/못 던짐/)).toBeTruthy()
    fireEvent.click(screen.getByText(마구칸.name))
    틱(8)
    expect(screen.getByText('1. 구질 선택')).toBeTruthy()
    expect(screen.queryByText(/2\. 코스 선택/)).toBeNull()
  })

  it('남은 횟수가 있으면 마구 칸이 코스 고르기로 넘어간다', () => {
    띄우기(2)
    expect(screen.queryByText(/못 던짐/)).toBeNull()
    expect(screen.getByText('마구 · 남은 2회')).toBeTruthy()
    fireEvent.click(screen.getByText(마구칸.name))
    틱(8)
    expect(screen.getByText(/2\. 코스 선택/)).toBeTruthy()
  })

  it('남은 0 이어도 다른 구질은 그대로 고를 수 있다', () => {
    띄우기(0)
    fireEvent.click(screen.getByText(직구.name))
    틱(8)
    expect(screen.getByText(/2\. 코스 선택/)).toBeTruthy()
  })

  it('남은 횟수를 안 넘기면(예전 부르는 쪽) 막지 않는다', () => {
    띄우기(undefined)
    fireEvent.click(screen.getByText(마구칸.name))
    틱(8)
    expect(screen.getByText(/2\. 코스 선택/)).toBeTruthy()
  })
})

describe('투수 미션 사람 견제 키 — 구질 고르기(0xf)에서만 0x53548 로 넘긴다', () => {
  function 견제띄우기() {
    vi.useFakeTimers()
    const onPickoffKey = vi.fn()
    render(
      <PitchingScreen
        run={startPitcherMission(PITCHER_MISSIONS[0]!)}
        repertoire={[직구]}
        usesGauge={false}
        atBat={createAtBat()}
        bannerText=""
        onThrow={() => {}}
        onGiveUp={() => {}}
        onFinish={() => {}}
        onPickoffKey={onPickoffKey}
      />,
    )
    return onPickoffKey
  }

  it('구질 단계의 키를 그대로 넘긴다 — 루 가르기·주자 확인은 부르는 쪽이 한다', () => {
    const onPickoffKey = 견제띄우기()
    fireEvent.keyDown(window, { key: '3' })
    fireEvent.keyDown(window, { key: '7' })
    expect(onPickoffKey.mock.calls).toEqual([['3'], ['7']])
  })

  it('누르고 있는 반복 키는 한 번만이다', () => {
    const onPickoffKey = 견제띄우기()
    fireEvent.keyDown(window, { key: '1', repeat: true })
    expect(onPickoffKey).not.toHaveBeenCalled()
  })

  it('코스 고르기(상태 0x10)로 넘어가면 받지 않는다', () => {
    const onPickoffKey = 견제띄우기()
    fireEvent.click(screen.getByText(직구.name))
    틱(8)
    expect(screen.getByText(/2\. 코스 선택/)).toBeTruthy()
    fireEvent.keyDown(window, { key: '3' })
    expect(onPickoffKey).not.toHaveBeenCalled()
  })
})

describe('투수 미션 상태 0xe — 새 타석마다 사람 OK 를 기다린다 (0x532b0)', () => {
  it('대기가 있으면 구질 고르기 대신 확인 소프트키가 서고, 세 갱신 뒤 OK 로 구질 고르기가 뜬다', () => {
    vi.useFakeTimers()
    try {
      render(
        <PitchingScreen
          run={startPitcherMission(PITCHER_MISSIONS[0]!)}
          repertoire={[직구]}
          usesGauge={false}
          atBat={createAtBat()}
          bannerText=""
          onThrow={vi.fn()}
          onGiveUp={() => {}}
          onFinish={() => {}}
          sceneConfirm={enterSceneConfirm()}
        />,
      )
      expect(screen.queryByText('1. 구질 선택')).toBeNull()
      // 0xd 두 그림 뒤 0xe — 투수·타자 소개 판(0x44944)이 선다
      expect(screen.queryByTestId('소개판')).toBeNull()
      act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * SCENE_PREPARE_FRAMES))
      expect(screen.getByTestId('소개판')).toBeTruthy()
      fireEvent.keyDown(window, { key: 'Enter' })
      expect(screen.queryByText('1. 구질 선택')).toBeNull()
      act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * SCENE_CONFIRM_READY_FRAMES))
      fireEvent.click(screen.getByRole('button', { name: '확인' }))
      expect(screen.getByText('1. 구질 선택')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('투수 미션 경기 중 메뉴 — 원본 미션 장면(0x104)도 \'*\' 로 연다 (0x498d4 · 표 0xcfcfc 행 1)', () => {
  function 메뉴화면(props: { onGiveUp?: () => void; onRestart?: () => void } = {}) {
    render(
      <PitchingScreen
        run={startPitcherMission(PITCHER_MISSIONS[0]!)}
        repertoire={[직구]}
        usesGauge={false}
        atBat={createAtBat()}
        bannerText=""
        onThrow={vi.fn()}
        onGiveUp={props.onGiveUp ?? (() => {})}
        onFinish={() => {}}
        onRestart={props.onRestart}
      />,
    )
  }

  it("'*' 로 열면 계속·다시하기·조작방법·설정·나가기 다섯 칸이 뜨고, 그 동안 투구 단계가 가려진다", () => {
    메뉴화면({ onRestart: vi.fn() })
    expect(screen.queryByRole('button', { name: '포기' })).toBeNull()
    fireEvent.keyDown(window, { key: '*' })
    for (const 칸 of ['계속', '다시하기', '조작방법', '설정', '나가기']) {
      expect(screen.getByText(칸)).toBeTruthy()
    }
    expect(screen.queryByText('자동진행')).toBeNull()
    expect(screen.queryByText('1. 구질 선택')).toBeNull()
    // '*' 로 닫는다
    fireEvent.keyDown(window, { key: '*' })
    expect(screen.getByText('1. 구질 선택')).toBeTruthy()
  })

  it('메뉴 소프트키로도 열리고, [나가기]를 확인하면 나가기 손잡이를 부른다', () => {
    const onGiveUp = vi.fn()
    메뉴화면({ onGiveUp })
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    fireEvent.click(screen.getByText('나가기'))
    fireEvent.click(screen.getByText('예'))
    expect(onGiveUp).toHaveBeenCalled()
  })
})

describe('투수 미션 조준 (상태 0x10) — 세션의 틱 0x39c5c 를 매 틱 부르고 확정한 조준점을 넘긴다', () => {
  function 조준띄우기() {
    vi.useFakeTimers()
    const onThrow = vi.fn()
    const onAimTick = vi.fn((aim: { x: number; y: number; z: number }, direction: { dx: number; dy: number }) => ({
      x: aim.x + direction.dx * 20,
      y: aim.y + direction.dy * 20,
      z: aim.z - direction.dy * 10,
    }))
    const onReturnToPitchSelection = vi.fn()
    render(
      <PitchingScreen
        run={startPitcherMission(PITCHER_MISSIONS[0]!)}
        repertoire={[직구]}
        usesGauge={false}
        atBat={createAtBat()}
        bannerText=""
        onThrow={onThrow}
        onAimTick={onAimTick}
        onReturnToPitchSelection={onReturnToPitchSelection}
        onGiveUp={() => {}}
        onFinish={() => {}}
      />,
    )
    fireEvent.keyDown(window, { key: 'Enter' })
    틱(8)
    return { onThrow, onAimTick, onReturnToPitchSelection }
  }

  it("'6' 을 누르면 오른쪽으로 흐르고, OK 틱까지 한 번 더 돈 조준점을 넘긴다", () => {
    const { onThrow, onAimTick } = 조준띄우기()
    fireEvent.keyDown(window, { key: '6' })
    틱(3)
    fireEvent.keyDown(window, { key: 'Enter' })

    // 세 틱은 오른쪽(dx 1), OK 틱은 방향을 지운 채(dx 0) 한 번 더
    expect(onAimTick.mock.calls.map(([, direction]) => direction)).toEqual([
      { dx: 1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 0 },
    ])
    expect(onThrow).toHaveBeenCalledTimes(1)
    expect(onThrow.mock.calls[0]![1]).toEqual({ x: 20585 + 60, y: 1202, z: 29705 })
  })

  it('CLR 은 던지지 않고 0xf 진입을 다시 부른다 (0x50ee0)', () => {
    const { onThrow, onReturnToPitchSelection } = 조준띄우기()
    fireEvent.keyDown(window, { key: 'Backspace' })

    expect(onThrow).not.toHaveBeenCalled()
    expect(onReturnToPitchSelection).toHaveBeenCalledTimes(1)
    expect(screen.getByText('1. 구질 선택')).toBeTruthy()
  })
})
