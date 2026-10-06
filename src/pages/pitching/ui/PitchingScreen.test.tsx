// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { SCENE_CONFIRM_LOCK_FRAMES } from '@/features/play-game/model/useSceneConfirm'
import { enterSceneConfirm } from '@/features/play-game/model/sceneConfirm'
import { PitchingScreen } from '@/pages/pitching/ui/PitchingScreen'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import type { PitchTypeInfo } from '@/shared/config/original/pitchTypes'
import { PITCHER_MISSIONS } from '@/entities/mission/model/missionGoal'
import { startPitcherMission } from '@/entities/mission/model/pitcherRun'
import { createAtBat } from '@/entities/at-bat/model/atBatState'

afterEach(cleanup)

/** 미션 메뉴의 마구 칸처럼 구속·변화 0 인 항목 (`modePitchMenuOf` 와 같은 모양) */
const 마구칸: PitchTypeInfo = { name: '스카이 포크 (남은 0회)', horizontalBreak: 0, verticalBreak: 0, speed: 0, flightSteps: [] }
const 직구 = PITCH_TYPES[0]!

function 띄우기(magicRemaining: number | undefined) {
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

describe('투수 미션 투구 화면의 마구 칸 (0x50db8)', () => {
  it('남은 횟수가 0 이면 마구 칸을 골라도 구질 단계에 그대로 머문다 — 키가 버려진다', () => {
    띄우기(0)
    expect(screen.getByText(/못 던짐/)).toBeTruthy()
    fireEvent.click(screen.getByText(마구칸.name))
    expect(screen.getByText('1. 구질 선택')).toBeTruthy()
    expect(screen.queryByText(/2\. 코스 선택/)).toBeNull()
  })

  it('남은 횟수가 있으면 마구 칸이 코스 고르기로 넘어간다', () => {
    띄우기(2)
    expect(screen.queryByText(/못 던짐/)).toBeNull()
    expect(screen.getByText('마구 · 남은 2회')).toBeTruthy()
    fireEvent.click(screen.getByText(마구칸.name))
    expect(screen.getByText(/2\. 코스 선택/)).toBeTruthy()
  })

  it('남은 0 이어도 다른 구질은 그대로 고를 수 있다', () => {
    띄우기(0)
    fireEvent.click(screen.getByText(직구.name))
    expect(screen.getByText(/2\. 코스 선택/)).toBeTruthy()
  })

  it('남은 횟수를 안 넘기면(예전 부르는 쪽) 막지 않는다', () => {
    띄우기(undefined)
    fireEvent.click(screen.getByText(마구칸.name))
    expect(screen.getByText(/2\. 코스 선택/)).toBeTruthy()
  })
})

describe('투수 미션 사람 견제 키 — 구질 고르기(0xf)에서만 0x53548 로 넘긴다', () => {
  function 견제띄우기() {
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
      fireEvent.keyDown(window, { key: 'Enter' })
      expect(screen.queryByText('1. 구질 선택')).toBeNull()
      act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * SCENE_CONFIRM_LOCK_FRAMES))
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
