// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
