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

/** 투구 단계 — 웹 글자 대신 누름 칸 판(testid)으로 가른다. 그림은 장면이 그린다 */
const 구질단계 = () => screen.queryByTestId('구질 누름 칸')
const 조준단계 = () => screen.queryByTestId('조준 영역')
/** 구질 칸 누름 칸 — 읽기 이름은 "키 구질" (0x534d8) */
const 칸 = (key: string, name: string) => screen.getByRole('button', { name: `${key} ${name}` }) as HTMLButtonElement

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
    expect(칸('2', 마구칸.name).disabled).toBe(true)
    fireEvent.click(칸('2', 마구칸.name))
    틱(8)
    expect(구질단계()).toBeTruthy()
    expect(조준단계()).toBeNull()
  })

  it('남은 횟수가 있으면 마구 칸이 코스 고르기로 넘어간다', () => {
    띄우기(2)
    expect(칸('2', 마구칸.name).disabled).toBe(false)
    fireEvent.click(칸('2', 마구칸.name))
    틱(8)
    expect(조준단계()).toBeTruthy()
  })

  it('남은 0 이어도 다른 구질은 그대로 고를 수 있다', () => {
    띄우기(0)
    fireEvent.click(칸('OK', 직구.name))
    틱(8)
    expect(조준단계()).toBeTruthy()
  })

  it('남은 횟수를 안 넘기면(예전 부르는 쪽) 막지 않는다', () => {
    띄우기(undefined)
    fireEvent.click(칸('2', 마구칸.name))
    틱(8)
    expect(조준단계()).toBeTruthy()
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
    // 견제 키도 다음 틀의 키 0x498d4 가 읽는다 — 구질 고르기의 키 칸에서 받은 차례대로
    expect(onPickoffKey).not.toHaveBeenCalled()
    틱(1)
    expect(onPickoffKey.mock.calls).toEqual([['3'], ['7']])
  })

  it('누르고 있는 반복 키는 한 번만이다', () => {
    const onPickoffKey = 견제띄우기()
    fireEvent.keyDown(window, { key: '1', repeat: true })
    expect(onPickoffKey).not.toHaveBeenCalled()
  })

  it('코스 고르기(상태 0x10)로 넘어가면 받지 않는다', () => {
    const onPickoffKey = 견제띄우기()
    fireEvent.click(칸('OK', 직구.name))
    틱(8)
    expect(조준단계()).toBeTruthy()
    fireEvent.keyDown(window, { key: '3' })
    expect(onPickoffKey).not.toHaveBeenCalled()
  })
})

describe('투수 미션 상태 0xe — 새 타석마다 사람 OK 를 기다린다 (0x532b0)', () => {
  it('대기가 있으면 구질 고르기 대신 확인 누름 칸이 서고, 세 갱신 뒤 OK 로 구질 고르기가 뜬다', () => {
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
      expect(구질단계()).toBeNull()
      // 0xd 두 그림 뒤 0xe — 투수·타자 소개 판(0x44944)이 선다
      expect(screen.queryByTestId('소개판')).toBeNull()
      act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * SCENE_PREPARE_FRAMES))
      expect(screen.getByTestId('소개판')).toBeTruthy()
      // '*' 일시정지 창 아래에도 남는다 — 0x52efe 가 장면 그리기를 건너뛰어 마지막 그림이 그대로다
      fireEvent.keyDown(window, { key: '*' })
      expect(screen.getByTestId('소개판')).toBeTruthy()
      fireEvent.keyDown(window, { key: '*' })
      fireEvent.keyDown(window, { key: 'Enter' })
      expect(구질단계()).toBeNull()
      act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * SCENE_CONFIRM_READY_FRAMES))
      fireEvent.click(screen.getByRole('button', { name: '확인' }))
      expect(구질단계()).toBeTruthy()
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
    for (const 메뉴칸 of ['계속하기', '재도전', '게임방법', '환경설정', '메인메뉴']) {
      expect(screen.getByRole('option', { name: 메뉴칸 })).toBeTruthy()
    }
    expect(screen.queryByRole('option', { name: '자동진행' })).toBeNull()
    // 투구 단계(누름 칸)는 가려진다 — 단계 상태는 그대로다
    expect(구질단계()?.closest('[hidden]')).toBeTruthy()
    // '*' 로 닫는다
    fireEvent.keyDown(window, { key: '*' })
    expect(구질단계()?.closest('[hidden]')).toBeNull()
  })

  it('메뉴 소프트키로도 열리고, [나가기]를 확인하면 나가기 손잡이를 부른다', () => {
    const onGiveUp = vi.fn()
    메뉴화면({ onGiveUp })
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    fireEvent.click(screen.getByRole('option', { name: '메인메뉴' }))
    fireEvent.click(screen.getByRole('button', { name: '예' }))
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
    // 키는 다음 틀의 키 0x498d4 가 읽는다
    틱(1)

    // 세 틱은 오른쪽(dx 1), OK 틱은 방향을 지운 채(dx 0) 한 번 더
    expect(onAimTick.mock.calls.map(([, direction]) => direction)).toEqual([
      { dx: 1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 0 },
    ])
    // OK 는 0x11 로 갈 뿐이다(0x50ed0) — 게이지를 안 써도 0x11 의 틱 10 에 놓는다(0x4e060)
    expect(onThrow).not.toHaveBeenCalled()
    틱(10)
    expect(onThrow).toHaveBeenCalledTimes(1)
    expect(onThrow.mock.calls[0]![1]).toEqual({ x: 20585 + 60, y: 1202, z: 29705 })
    // 게이지를 안 쓴 공 — 칸 0 · 게이지 안 씀
    expect(onThrow.mock.calls[0]![2]).toBe(0)
    expect(onThrow.mock.calls[0]![3]).toBe(false)
  })

  it('CLR 은 던지지 않고 0xf 진입을 다시 부른다 (0x50ee0)', () => {
    const { onThrow, onReturnToPitchSelection } = 조준띄우기()
    fireEvent.keyDown(window, { key: 'Backspace' })
    틱(1)

    expect(onThrow).not.toHaveBeenCalled()
    expect(onReturnToPitchSelection).toHaveBeenCalledTimes(1)
    expect(구질단계()).toBeTruthy()
  })
})
