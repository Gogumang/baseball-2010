// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createCareer } from '@/entities/career/model/playerCareer'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { startGame } from '@/features/play-game/model/gameFlow'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { createBurstSession } from '@/entities/burst-mission/model/burstMissionSession'
import { BURST_TABLES } from '@/entities/burst-mission/model/burstMissionRow'
import { chainSceneConfirm, enterSceneConfirm } from '@/features/play-game/model/sceneConfirm'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import { SCENE_CONFIRM_READY_FRAMES, useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/** 경기 화면 대신 — 진짜 화면처럼 0xe 대기를 `useSceneConfirm` 으로 받는다(덮개가 있으면 안 받음) */
const 화면: { confirm?: () => void; isPaused?: boolean } = {}
vi.mock('@/pages/game/ui/GameScreen', () => ({
  GameScreen: (props: { progress: { sceneConfirm?: SceneConfirmWait | null }; isPaused: boolean }) => {
    const scene = useSceneConfirm(props.progress.sceneConfirm, !props.isPaused)
    화면.confirm = scene.confirm
    화면.isPaused = props.isPaused
    return null
  },
}))
vi.mock('@/widgets/burst-mission/ui/BurstMissionWindow', () => ({
  BurstMissionWindow: () => <div data-testid="돌발창" />,
}))

const { GameRoute } = await import('@/app/ui/GameRoute')

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function 잠금풀기() {
  act(() => {
    vi.advanceTimersByTime(SCENE_CONFIRM_READY_FRAMES * millisecondsPerFrame())
  })
}

const 띄우기 = (wait: SceneConfirmWait) => {
  const base = startGame(createSeededRandom(20100901))
  const session = createBurstSession(4)!
  const progress: GameProgress = {
    ...base,
    // 경기 시작 자동진행(0x21) 중계는 이 시험의 몫이 아니다 — 곧장 내 타석
    autoRelay: null,
    burst: { ...session, current: BURST_TABLES[session.table][0]! },
    lastBurstResolution: null,
    sceneConfirm: wait,
  }
  const noop = () => {}
  render(
    <GameRoute
      session={{
        loadingTip: null,
        handlePitchResolved: noop,
        actions: { finishLoading: noop, finishDefensePlay: noop, closeBurstResult: noop },
      } as never}
      progress={progress}
      runner={{ atBat: createAtBat(), isPaused: false, bannerText: '' } as never}
      random={createSeededRandom(1)}
      career={createCareer('테스트')}
      gameSettings={{ settings: {}, setSettings: noop } as never}
    />,
  )
  // 경기 시작 인트로(상태 0xc)를 OK 로 건너뛴다
  fireEvent.keyDown(window, { key: 'Enter' })
}

describe('나리 타자편 돌발 제안 창(0x1b)은 상태 0xe 의 OK 뒤에 선다 (0x50c18 → 0x50c42 0x8f158)', () => {
  it('OK 전에는 창이 없고 타석도 멈추지 않는다 — OK 를 받으면 그때 창이 선다', () => {
    띄우기(enterSceneConfirm())
    expect(screen.queryByTestId('돌발창')).toBeNull()
    expect(화면.isPaused).toBe(false)
    잠금풀기()
    act(() => 화면.confirm!())
    expect(screen.getByTestId('돌발창')).toBeTruthy()
    expect(화면.isPaused).toBe(true)
  })

  it('같은 걸음에 0xe 를 두 번 지났으면(CPU 투수 교체 뒤 다시 굴린 돌발) 두 OK 를 다 받은 뒤다', () => {
    띄우기(chainSceneConfirm(enterSceneConfirm()))
    잠금풀기()
    act(() => 화면.confirm!())
    expect(screen.queryByTestId('돌발창')).toBeNull()
    잠금풀기()
    act(() => 화면.confirm!())
    expect(screen.getByTestId('돌발창')).toBeTruthy()
  })
})
