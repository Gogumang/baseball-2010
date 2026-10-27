// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { SaveGamePort } from '@/shared/api/save/saveGamePort'
import type { Screen } from '@/app/model/screen'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import { useCareerSession } from '@/app/model/useCareerSession'
import type { GameAutoRelay, GameProgress } from '@/features/play-game/model/gameFlow'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/**
 * **경기를 끝낸 타석의 돌발 결과 창 → 남은 중계 → 경기 끝 판 · 정산 — 나리 타자편 (A-38 · r317 의 짝)**.
 * 원본 0x12 끝(4e7ca) · 0x17 끝(52a8e)의 돌발 판정 0x8f414 가 참이면 0x1d · 0x1c(결과 창 · 진입 보상 0x8e34c)를 먼저 거친 뒤 +0x1b6c 로
 * 간다 — 그것이 0x35108 이 0x21 로 덮은 자동진행 중계여도 같고, 중계가 경기를 끝내면 그 다음이 경기 끝 판 0x18 · 정산 0x19 다(K · R10).
 * 예전 웹은 중계 갈래가 경기 장면(창이 얹히는 자리)보다 앞이라 중계가 창보다 먼저 돌았고, 창을 닫는 대로 정산했다.
 *
 * 앱 그대로 — 세션(`useCareerSession`) + 경기 화면(`GameRoute`)을 띄우고, 타석 화면만 흉내(헛스윙만)로 바꾼다. 씨앗 15 는 첫 경기
 * 마지막 내 타석에 돌발이 판정되고 그 뒤 동료 · 상대 타석(중계)이 남은 채 경기가 끝난다(r315 시험과 같은 경기)
 */
vi.mock('@/widgets/loading-tip/ui/LoadingTip', async (importOriginal) => {
  const { useEffect } = await import('react')
  return {
    ...(await importOriginal<object>()),
    LoadingTip: ({ onDone }: { onDone: () => void }) => {
      useEffect(() => {
        onDone()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return null
    },
  }
})
vi.mock('@/widgets/game-scene/ui/GameIntro', async (importOriginal) => {
  const { useEffect } = await import('react')
  return {
    ...(await importOriginal<object>()),
    GameIntro: ({ onDone }: { onDone: () => void }) => {
      useEffect(() => {
        onDone()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return null
    },
  }
})

/** 타석 화면 대신 — 0xe 대기를 `useSceneConfirm` 으로 받고, 공 판정을 화면처럼 `onPitchResolved` 로 낸다 */
const 화면 = vi.hoisted(() => ({
  isPaused: true,
  isAwaiting: false,
  confirm: null as null | (() => void),
  pitch: null as null | ((detail: unknown, pitch: unknown) => unknown),
}))
vi.mock('@/pages/game/ui/GameScreen', () => ({
  GameScreen: (props: {
    progress: { sceneConfirm?: SceneConfirmWait | null }
    isPaused: boolean
    onPitchResolved: (detail: unknown, pitch: unknown) => unknown
  }) => {
    const scene = useSceneConfirm(props.progress.sceneConfirm, !props.isPaused)
    화면.isPaused = props.isPaused
    화면.isAwaiting = scene.isAwaiting
    화면.confirm = scene.confirm
    화면.pitch = props.onPitchResolved
    return <div data-testid="타석화면" />
  },
}))
/** 돌발 창 — 판정 창이면 `data-judged` */
const 창 = vi.hoisted(() => ({ close: null as null | (() => void) }))
vi.mock('@/widgets/burst-mission/ui/BurstMissionWindow', () => ({
  BurstMissionWindow: ({ judgement, onClose }: { judgement: unknown; onClose: () => void }) => {
    창.close = onClose
    return <div data-testid="돌발창" data-judged={judgement === null ? 'no' : 'yes'} />
  },
}))

const { GameRoute } = await import('@/app/ui/GameRoute')

function 메모리저장(held: PlayerCareer | null): SaveGamePort {
  let saved = held
  return {
    load: () => saved,
    save: (career) => {
      saved = career
    },
    clear: () => {
      saved = null
    },
  }
}

const 헛스윙: PitchOutcomeDetail = {
  batterHand: 0, resolution: { kind: '스트라이크', isSwinging: true }, hasSwung: true, isBunt: false, resultCode: null, contactSoundId: null,
}

interface 판 {
  screen: Screen
  progress: GameProgress | null
  actions: ReturnType<typeof useCareerSession>['actions']
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

interface 경기끝 {
  /** 경기가 끝난 걸음에 아직 안 튼 중계 — 경기를 끝낸 남은 동료 · 상대 타석 */
  readonly finalRelay: GameAutoRelay | null
  /** 경기를 끝낸 걸음에 돌발 판정이 남았는가 */
  readonly judgedAtEnd: boolean
  /** 판정이 남은 동안 중계가 섰는가 */
  readonly relayBeforeWindow: boolean
  /** 끝난 경기의 판정 창이 섰는가 */
  readonly windowShownAtEnd: boolean
  /** 경기가 끝난 뒤(창을 닫은 뒤) 중계가 선 틀 수 */
  readonly relayFramesAfterEnd: number
  readonly screenKind: Screen['kind']
}

/** 이어하기 → 다음 경기를 앱 화면으로 치른다 — 헛스윙만 · 제안 창은 바로 닫는다 */
async function 치르기(seed: number): Promise<경기끝> {
  const random = createSeededRandom(seed)
  const saveGame = 메모리저장(createCareer('돌발'))
  const 지금: { current: 판 | null } = { current: null }
  function Harness() {
    const [screenNow, setScreen] = useState<Screen>({ kind: '메인메뉴' })
    const runner = useAtBatRunner()
    const session = useCareerSession({ runner, random, saveGame, screen: screenNow, setScreen })
    지금.current = { screen: screenNow, progress: session.progress, actions: session.actions }
    if (screenNow.kind !== '경기' || session.progress === null || session.career === null) return null
    return (
      <GameRoute
        session={session}
        progress={session.progress}
        runner={runner}
        random={random}
        career={session.career}
        gameSettings={{ settings: {}, setSettings: () => {} } as never}
      />
    )
  }
  // 이어하기 → 관리 화면까지는 진짜 시계로
  render(<Harness />)
  act(() => 지금.current!.actions.continueSaved())
  await waitFor(() => expect(지금.current!.screen.kind).not.toBe('메인메뉴'), { timeout: 5000 })
  vi.useFakeTimers()
  const frame = () => act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
  act(() => 지금.current!.actions.runCommand('다음경기'))
  act(() => 지금.current!.actions.confirmNextGameStandings())
  act(() => 지금.current!.actions.confirmMatchPrepare())
  frame()
  expect(지금.current!.screen.kind).toBe('경기')

  /** 화면이 튼 중계 묶음 */
  const shownRelays = new Set<GameAutoRelay>()
  let isEndSeen = false
  let finalRelay: GameAutoRelay | null = null
  let judgedAtEnd = false
  let relayBeforeWindow = false
  let windowShownAtEnd = false
  let relayFramesAfterEnd = 0
  let lastPitchFrame = -100
  for (let tick = 0; tick < 40_000 && 지금.current!.screen.kind === '경기'; tick += 1) {
    const { progress } = 지금.current!
    if (progress === null) break
    const relayShown = screen.queryByTestId('중계-공격팀') !== null
    if (progress.game.isFinished && !isEndSeen) {
      isEndSeen = true
      const relay = progress.autoRelay ?? null
      finalRelay = relay !== null && !shownRelays.has(relay) ? relay : null
      judgedAtEnd = progress.lastBurstResolution !== null
    }
    if (relayShown && progress.autoRelay != null) shownRelays.add(progress.autoRelay)
    if (progress.game.isFinished && progress.lastBurstResolution !== null && relayShown) relayBeforeWindow = true
    const window = screen.queryByTestId('돌발창')
    if (window !== null) {
      if (window.dataset.judged === 'yes' && progress.game.isFinished) windowShownAtEnd = true
      act(() => 창.close!())
    } else if (progress.game.isFinished && relayShown) {
      relayFramesAfterEnd += 1
    } else if (
      screen.queryByTestId('타석화면') !== null && !화면.isPaused && !progress.game.isFinished && tick - lastPitchFrame > 8
    ) {
      if (화면.isAwaiting) act(() => 화면.confirm!())
      else {
        lastPitchFrame = tick
        act(() => void 화면.pitch!(헛스윙, null))
      }
    }
    frame()
  }
  return {
    finalRelay, judgedAtEnd, relayBeforeWindow, windowShownAtEnd, relayFramesAfterEnd, screenKind: 지금.current!.screen.kind,
  }
}

describe('나리 타자편 돌발 결과 창 → 남은 중계 → 경기 끝 (A-38 — 0x12 끝 4e7ca · 0x35108 의 0x21)', () => {
  it('경기를 끝낸 내 타석의 판정 창이 남은 중계보다 먼저 서고, 정산은 그 중계를 다 튼 뒤다', async () => {
    const end = await 치르기(15)
    // 씨앗 15 — 마지막 내 타석에 판정이 나고 그 뒤에 중계가 남는다
    expect(end.judgedAtEnd).toBe(true)
    expect(end.finalRelay?.ticks.length ?? 0).toBeGreaterThan(0)
    // 창이 먼저다 — 판정이 남은 동안 중계가 서지 않는다
    expect(end.relayBeforeWindow).toBe(false)
    expect(end.windowShownAtEnd).toBe(true)
    // 창을 닫은 뒤 남은 중계를 다 틀고서야 경기 끝 정산
    expect(end.relayFramesAfterEnd).toBeGreaterThanOrEqual(end.finalRelay!.ticks.length)
    expect(end.screenKind).toBe('경기결과')
  }, 120_000)

  it('판정이 없어도 경기를 끝낸 남은 중계를 다 튼 뒤에 정산이다 (예전 웹은 0x12 대기 끝 배너에서 곧장 정산해 중계가 잘렸다)', async () => {
    const end = await 치르기(3)
    // 씨앗 3 — 마지막 내 타석 뒤 중계 8 틱이 경기를 끝낸다, 판정은 없다
    expect(end.judgedAtEnd).toBe(false)
    expect(end.finalRelay?.ticks.length ?? 0).toBeGreaterThan(0)
    expect(end.relayFramesAfterEnd).toBeGreaterThanOrEqual(end.finalRelay!.ticks.length)
    expect(end.screenKind).toBe('경기결과')
  }, 120_000)
})
