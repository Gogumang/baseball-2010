// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCareerSession } from '@/app/model/useCareerSession'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import type { Screen } from '@/app/model/screen'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { GAME_INTRO_SOUND } from '@/features/play-game/model/gameSounds'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'
import { isFairAngle } from '@/entities/batting/model/battedBallOutcome'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import type { SaveGamePort } from '@/shared/api/save/saveGamePort'

/**
 * **소리가 실제로 통로까지 가는지** 본다 — 번호를 고르는 규칙은
 * `features/play-at-bat/model/atBatSounds.test.ts` · `features/play-game/model/gameSounds.test.ts`,
 * 효과음 뒤 배경음 복귀는 `shared/api/audio/webAudioSound.test.ts` 가 따로 못 박는다.
 */

/** 무엇이 몇 번 울렸는지 적어 두는 포트 */
function 녹음포트() {
  const played: number[] = []
  let bgm: number | null = null
  const port: SoundPort = {
    play: (id) => {
      played.push(id)
    },
    playBgm: (id) => {
      bgm = id
    },
    stopBgm: () => {
      bgm = null
    },
    resumeBgm: () => {},
    currentBgm: () => bgm,
    setVolume: () => {},
    getVolume: () => 100,
  }
  return { played, port }
}

function 메모리저장(held: PlayerCareer): SaveGamePort {
  let saved: PlayerCareer | null = held
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

const 공 = (overrides: Partial<PitchOutcomeDetail>): PitchOutcomeDetail => ({
  resolution: { kind: '볼' },
  hasSwung: false,
  isBunt: false,
  resultCode: null,
  contactSoundId: null,
  ...overrides,
})

/**
 * 타석이 끝나면 결과 배너 타이머(1.5초)가 걸린다. 테스트가 끝난 뒤 그 타이머가 늦게 터지면
 * 이미 정리된 React 뿌리를 건드려 "Should not already be working" 가 난다 —
 * `useAtBatRunner` 의 정리 effect 가 타이머를 지우므로 매 테스트 뒤 반드시 떼어낸다.
 */
const 떼어낼것: (() => void)[] = []
afterEach(() => {
  while (떼어낼것.length > 0) 떼어낼것.pop()?.()
})

const 경기시작 = () => {
  const 녹음 = 녹음포트()
  const saveGame = 메모리저장(createCareer('소리'))
  const random = createSeededRandom(20100901)
  const rendered = renderHook(() => {
    const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
    const runner = useAtBatRunner()
    return {
      screen,
      session: useCareerSession({ runner, random, saveGame, screen, setScreen, sound: 녹음.port }),
    }
  })
  떼어낼것.push(() => act(() => rendered.unmount()))
  act(() => rendered.result.current.session.actions.continueSaved())
  act(() => rendered.result.current.session.actions.runCommand('다음경기'))
  // 109 순위표 확인 → 경기
  act(() => rendered.result.current.session.actions.confirmNextGameStandings())
  // 142 경기 준비 확인 → 144 → 경기
  act(() => rendered.result.current.session.actions.confirmMatchPrepare())
  return { rendered, played: 녹음.played }
}

describe('경기 소리 배선', () => {
  it('로딩이 끝나면 경기 시작 인트로 소리 61 이 난다', () => {
    const { rendered, played } = 경기시작()
    expect(rendered.result.current.screen).toEqual({ kind: '경기' })
    expect(played).toEqual([])

    act(() => rendered.result.current.session.actions.finishLoading())

    expect(played).toEqual([GAME_INTRO_SOUND])
  })

  it('볼 판정마다 "Ball!" 16 이 난다', () => {
    const { rendered, played } = 경기시작()
    act(() => rendered.result.current.session.actions.finishLoading())
    played.length = 0

    act(() => rendered.result.current.session.handlePitchResolved(공({ resolution: { kind: '볼' } })))

    expect(played).toEqual([16])
  })

  it('헛스윙은 바람 소리 뒤에 스트라이크 콜 — 두 번째 스트라이크는 39 다', () => {
    const { rendered, played } = 경기시작()
    act(() => rendered.result.current.session.actions.finishLoading())
    played.length = 0

    const 헛스윙 = 공({ resolution: { kind: '스트라이크', isSwinging: true }, hasSwung: true, contactSoundId: 8 })
    act(() => rendered.result.current.session.handlePitchResolved(헛스윙))
    expect(played).toEqual([8, 18])

    act(() => rendered.result.current.session.handlePitchResolved(헛스윙))
    expect(played).toEqual([8, 18, 8, 39])
  })

  it('세 번째 스트라이크에서 "Strike out!" 21 이 난다', () => {
    const { rendered, played } = 경기시작()
    act(() => rendered.result.current.session.actions.finishLoading())
    const 헛스윙 = 공({ resolution: { kind: '스트라이크', isSwinging: true }, hasSwung: true, contactSoundId: 8 })
    act(() => rendered.result.current.session.handlePitchResolved(헛스윙))
    act(() => rendered.result.current.session.handlePitchResolved(헛스윙))
    played.length = 0

    act(() => rendered.result.current.session.handlePitchResolved(헛스윙))

    expect(played.slice(0, 2)).toEqual([8, 21])
  })

  it('네 번째 볼에서 "Base on balls!" 24 가 난다', () => {
    const { rendered, played } = 경기시작()
    act(() => rendered.result.current.session.actions.finishLoading())
    const 볼 = 공({ resolution: { kind: '볼' } })
    for (let count = 0; count < 3; count += 1) {
      act(() => rendered.result.current.session.handlePitchResolved(볼))
    }
    played.length = 0

    act(() => rendered.result.current.session.handlePitchResolved(볼))

    expect(played.slice(0, 1)).toEqual([24])
  })

  it('홈런은 타격음 뒤에 함성 11 이 난다', () => {
    const { rendered, played } = 경기시작()
    act(() => rendered.result.current.session.actions.finishLoading())
    played.length = 0

    act(() =>
      rendered.result.current.session.handlePitchResolved(
        공({
          resolution: { kind: '타구', outcome: { kind: '홈런' } },
          hasSwung: true,
          resultCode: 24,
          contactSoundId: 7,
        }),
      ),
    )

    expect(played.slice(0, 2)).toEqual([7, 11])
  })

  it('인플레이 타구는 타격음만 먼저 나고, 수비가 끝난 뒤에 아웃 콜 20 이 난다', () => {
    const { rendered, played } = 경기시작()
    act(() => rendered.result.current.session.actions.finishLoading())
    played.length = 0

    act(() =>
      rendered.result.current.session.handlePitchResolved(
        공({
          resolution: { kind: '타구', outcome: { kind: '아웃', detail: '땅볼아웃' } },
          hasSwung: true,
          resultCode: 0,
          contactSoundId: 6,
        }),
      ),
    )

    // 수비 화면이 도는 동안에는 타격음 하나뿐이다
    expect(played).toEqual([6])
    expect(rendered.result.current.session.progress?.pendingDefensePlay).not.toBeNull()

    act(() => rendered.result.current.session.actions.finishDefensePlay())

    expect(played.slice(0, 2)).toEqual([6, 20])
  })
})

describe('내 타석의 파울 각 공 — 판을 돌고 판이 파울로 닫힐 때 "Foul!" 25 (결과 코드 7 메시지 51c5c)', () => {
  const 파울코드 = Object.entries(BATTED_BALL_PATTERNS).flatMap(([code, patterns]) =>
    patterns.filter((pattern) => !isFairAngle(pattern[0])).map((pattern) => ({ resultCode: Number(code), pattern })),
  )[0]
  const 파울 = 공({
    resolution: { kind: '파울' },
    hasSwung: true,
    resultCode: 파울코드.resultCode,
    pattern: 파울코드.pattern,
    foulContact: 파울코드,
    contactSoundId: 6,
  })
  const 띄우기 = () => {
    const 녹음 = 녹음포트()
    const saveGame = 메모리저장(createCareer('파울판'))
    const random = createSeededRandom(20100901)
    const rendered = renderHook(() => {
      const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
      const runner = useAtBatRunner()
      return { runner, session: useCareerSession({ runner, random, saveGame, screen, setScreen, sound: 녹음.port }) }
    })
    떼어낼것.push(() => act(() => rendered.unmount()))
    act(() => rendered.result.current.session.actions.continueSaved())
    act(() => rendered.result.current.session.actions.runCommand('다음경기'))
    act(() => rendered.result.current.session.actions.confirmNextGameStandings())
    act(() => rendered.result.current.session.actions.confirmMatchPrepare())
    act(() => rendered.result.current.session.actions.finishLoading())
    녹음.played.length = 0
    return { rendered, played: 녹음.played }
  }

  it('공 판정 자리에서는 타격음만 — 스트라이크는 판이 닫힐 때까지 안 오르고, 파울로 닫히면 +1 · 25 · 다음 공', () => {
    const { rendered, played } = 띄우기()
    act(() => rendered.result.current.session.handlePitchResolved(파울))

    expect(played).toEqual([6])
    const pending = rendered.result.current.session.progress?.pendingDefensePlay ?? null
    expect(pending).not.toBeNull()
    expect(pending?.strikes).toBe(0)
    expect(rendered.result.current.runner.atBat.strikes).toBe(0)
    expect(rendered.result.current.runner.isPaused).toBe(true)

    const 경기전 = rendered.result.current.session.progress?.game
    // 판이 파울로 닫힌 결과 — 진행기의 `foulEnded`(0x9d5bc 가 7) 갈래만 본다
    act(() =>
      rendered.result.current.session.actions.finishDefensePlay({
        ...runDefensePlay(pending!),
        foulEnded: true,
        outcome: undefined,
        caughtOnTheFly: false,
      }),
    )

    expect(played).toEqual([6, 25])
    expect(rendered.result.current.session.progress?.pendingDefensePlay).toBeNull()
    expect(rendered.result.current.session.progress?.game).toEqual(경기전)
    expect(rendered.result.current.runner.atBat.strikes).toBe(1)
    expect(rendered.result.current.runner.isPaused).toBe(false)
  })

  it('낙구 전에 잡힌 파울 각 공(파울 뜬공 아웃)은 25 없이 잡은 아웃 콜 62 로 타석이 끝난다', () => {
    const { rendered, played } = 띄우기()
    act(() => rendered.result.current.session.handlePitchResolved(파울))
    const pending = rendered.result.current.session.progress!.pendingDefensePlay!
    const 경기전 = rendered.result.current.session.progress!.game
    const played판 = runDefensePlay(pending)
    act(() =>
      rendered.result.current.session.actions.finishDefensePlay({
        ...played판,
        foulEnded: undefined,
        foulStrikes: undefined,
        outcome: { kind: '아웃', detail: '뜬공아웃' },
        caughtOnTheFly: true,
        advance: { bases: pending.bases, runsScored: 0, outsAdded: 1 },
      }),
    )

    expect(played.slice(0, 2)).toEqual([6, 62])
    expect(played).not.toContain(25)
    const 뒤 = rendered.result.current.session.progress!.game
    expect(뒤.outs !== 경기전.outs || 뒤.half !== 경기전.half || 뒤.inning !== 경기전.inning).toBe(true)
  })
})
