// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createCareer } from '@/entities/career/model/playerCareer'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { startGame } from '@/features/play-game/model/gameFlow'

/** 타석 화면 대역 — 비행 판정 칸에 "지금 공이 나는가" 를 꽂는다 */
let 날고있다 = false
vi.mock('@/widgets/batting-stage/ui/BattingStage', () => ({
  BattingStage: (props: { flightProbeRef?: { current: (() => boolean) | null } }) => {
    if (props.flightProbeRef !== undefined) props.flightProbeRef.current = () => 날고있다
    return null
  },
}))

const { GameScreen } = await import('@/pages/game/ui/GameScreen')

afterEach(() => {
  cleanup()
  날고있다 = false
})

const 띄우기 = (onSteal: (base: 1 | 2 | 3) => void) => {
  const base = startGame(createSeededRandom(20100901))
  return render(
    <GameScreen
      career={createCareer('테스트')}
      // 0xe 의 OK 는 이미 받은 자리 — 공이 나는 동안(0x11)만 본다
      progress={{ ...base, sceneConfirm: null, game: { ...base.game, bases: { first: true, second: false, third: false } } }}
      atBat={createAtBat()}
      pitcherAbility={DEFAULT_PITCHER_ABILITY}
      isPaused={false}
      bannerText=""
      random={createSeededRandom(1)}
      onPitchResolved={vi.fn()}
      onQuit={vi.fn()}
      onSteal={onSteal}
    />,
  )
}

describe('도루 키는 공이 나는 동안(상태 0x11)만 받는다 — BattingStage.flightProbeRef', () => {
  it('공이 날 때 3 키 · 소프트키가 도루를 건다', () => {
    const onSteal = vi.fn()
    띄우기(onSteal)
    날고있다 = true

    fireEvent.keyDown(window, { key: '3' })
    expect(onSteal).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getByRole('button', { name: '도루 1루' }))
    expect(onSteal).toHaveBeenCalledTimes(2)
  })

  it('공이 안 날 때는 키도 소프트키도 먹고 끝난다', () => {
    const onSteal = vi.fn()
    띄우기(onSteal)

    fireEvent.keyDown(window, { key: '3' })
    fireEvent.click(screen.getByRole('button', { name: '도루 1루' }))
    expect(onSteal).not.toHaveBeenCalled()
  })
})
