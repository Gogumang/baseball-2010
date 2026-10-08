// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createCareer } from '@/entities/career/model/playerCareer'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { startGame } from '@/features/play-game/model/gameFlow'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { RecordAlertFrame } from '@/widgets/game-scene/lib/recordAlert'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/** 경기 화면 대신 — 받은 알림 그림과 판정 통로만 잡아 둔다 */
const 화면: {
  recordAlert?: RecordAlertFrame
  onPitchResolved?: (detail: PitchOutcomeDetail) => void
} = {}
vi.mock('@/pages/game/ui/GameScreen', () => ({
  GameScreen: (props: { recordAlert?: RecordAlertFrame; onPitchResolved: (detail: PitchOutcomeDetail) => void }) => {
    화면.recordAlert = props.recordAlert
    화면.onPitchResolved = props.onPitchResolved
    return null
  },
}))

const { GameRoute } = await import('@/app/ui/GameRoute')

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const tick = (count = 1) => act(() => {
  vi.advanceTimersByTime(millisecondsPerFrame() * count)
})

const BALL: PitchOutcomeDetail = {
  resolution: { kind: '볼' },
  hasSwung: false,
  isBunt: false,
  resultCode: null,
  contactSoundId: null,
}

describe('나리 타자편 기록 달성 알림 — 칸 채우기 0x4e600 은 원본 공 끝(0x12 대기 끝)에', () => {
  it('볼넷 타석의 내 몫(2볼넷 34)은 31틱 뒤에 들고, 같은 걸음의 자동 타석 몫(동료 3루타 0)은 다음 공 끝에 든다', () => {
    const started = startGame(createSeededRandom(20101007))
    const base: GameProgress = {
      ...started,
      // 경기 시작 자동진행(0x21) 중계는 이 시험의 몫이 아니다 — 곧장 내 타석
      autoRelay: null,
      recordIds: [],
      myStats: { ...started.myStats, walks: 1 },
    }
    // 내 볼넷(2볼넷 34) 뒤 자동진행에서 동료가 3루타(0)를 쳤다 — 진행기는 한 걸음에 붙인다
    const after: GameProgress = {
      ...base,
      recordIds: [34, 0],
      myStats: { ...base.myStats, plateAppearances: base.myStats.plateAppearances + 1, walks: 2 },
      consecutiveHits: 0,
    }
    const noop = () => {}
    const props = (progress: GameProgress, balls: number) => ({
      session: {
        loadingTip: null,
        handlePitchResolved: noop,
        actions: { finishLoading: noop, finishDefensePlay: noop, closeBurstResult: noop },
      } as never,
      progress,
      runner: { atBat: { ...createAtBat(), balls }, isPaused: false, bannerText: '' } as never,
      random: createSeededRandom(1),
      career: createCareer('테스트'),
      gameSettings: { settings: {}, setSettings: noop } as never,
    })
    const { rerender } = render(<GameRoute {...props(base, 3)} />)
    // 경기 시작 인트로(상태 0xc)를 OK 로 건너뛴다
    fireEvent.keyDown(window, { key: 'Enter' })

    // 볼 넷째 — 판정과 진행기 걸음이 한 그림에 든다
    act(() => {
      화면.onPitchResolved!(BALL)
      rerender(<GameRoute {...props(after, 0)} />)
    })
    // 상태 틱 31 에 칸이 차고 그 다음 갱신의 0x4e35c 가 그린다
    tick(31)
    expect(화면.recordAlert?.rows ?? []).toHaveLength(0)
    tick()
    expect(화면.recordAlert?.rows.map((row) => row.slot)).toEqual([0])

    // 다음 사람 공(볼 하나) 끝 — 줄에 남은 동료 몫이 든다
    act(() => 화면.onPitchResolved!(BALL))
    tick(15)
    expect(화면.recordAlert?.rows.map((row) => row.slot)).toEqual([0])
    tick()
    expect(화면.recordAlert?.rows.map((row) => row.slot)).toEqual([0, 1])
  })
})
