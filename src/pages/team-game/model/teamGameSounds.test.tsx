// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { useTeamGame } from '@/pages/team-game/model/useTeamGame'
import { TeamGameScreen } from '@/pages/team-game/ui/TeamGameScreen'
import type { TeamGameOptions } from '@/pages/team-game/model/useTeamGame'
import { PITCHER_CHANGE_SOUND, stepSoundIdsOf } from '@/pages/team-game/model/teamGameSounds'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { GAME_INTRO_SOUND, HALF_INNING_SOUND } from '@/features/play-game/model/gameSounds'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { setActiveSound } from '@/shared/api/audio/soundPort'
import type { SoundPort } from '@/shared/api/audio/soundPort'

/**
 * **팀 경기 화면까지 소리가 가는지** 본다 — 번호를 고르는 규칙 자체는
 * `features/play-at-bat/model/atBatSounds.test.ts` 가, 효과음 뒤 배경음 복귀는
 * `shared/api/audio/webAudioSound.test.ts` 가 따로 못 박는다.
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

const 기본옵션: TeamGameOptions = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
}

let 녹음 = 녹음포트()
beforeEach(() => {
  녹음 = 녹음포트()
  setActiveSound(녹음.port)
})
afterEach(() => setActiveSound(null))

const 띄우기 = (options: Partial<TeamGameOptions> = {}, seed = 20100901) => {
  const random = createSeededRandom(seed)
  return renderHook(() => useTeamGame({ ...기본옵션, ...options }, random))
}

const 공 = (overrides: Partial<PitchOutcomeDetail>): PitchOutcomeDetail => ({
  resolution: { kind: '볼' },
  hasSwung: false,
  isBunt: false,
  resultCode: null,
  contactSoundId: null,
  ...overrides,
})

describe('진행 소리 고르기 — `gameSounds.gameStepSoundIdsOf` 와 같은 규칙', () => {
  const 진행 = (half: string, inning: number, isFinished = false) => ({
    game: { half, inning, isFinished },
    burst: null,
    lastBurstResolution: null,
  })

  it('반 이닝이 바뀌면 공수 교대 징글 13 (상태 0x18, 0x4f7ac)', () => {
    expect(stepSoundIdsOf(진행('초', 1), 진행('말', 1))).toEqual([HALF_INNING_SOUND])
  })

  it('경기가 끝나며 바뀐 것이면 13 을 안 낸다 — 그 자리는 결과 징글이다 (R10 2절)', () => {
    expect(stepSoundIdsOf(진행('초', 9), 진행('말', 9, true))).toEqual([])
  })

  it('아무것도 안 바뀌면 조용하다', () => {
    expect(stepSoundIdsOf(진행('초', 1), 진행('초', 1))).toEqual([])
  })
})

describe('팀 경기 화면의 소리 배선', () => {
  it('경기가 서면 인트로 예약음 61 이 난다 (상태 0xc 진입 0x3b148)', () => {
    띄우기()
    expect(녹음.played[0]).toBe(GAME_INTRO_SOUND)
  })

  it('사람 타석 — 타구음 뒤에 심판 콜이 붙는다 (0x515de~ → 0x51a94)', () => {
    const { result } = 띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT })
    녹음.played.length = 0

    act(() =>
      result.current.actions.resolvePitch(
        공({ resolution: { kind: '스트라이크', isSwinging: true }, hasSwung: true, contactSoundId: 8 }),
      ),
    )

    // 8 헛스윙 바람 소리 → 18 "Strike!"
    expect(녹음.played).toEqual([8, 18])
  })

  it('인플레이 타구의 아웃 콜(20)은 수비 화면이 끝난 뒤에야 난다 (0x51b36)', () => {
    const { result } = 띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT })
    녹음.played.length = 0

    act(() => result.current.actions.applyOutcome({ kind: '아웃', detail: '땅볼아웃' }))
    expect(녹음.played).toEqual([])

    const 결과 = runDefensePlay(result.current.pendingDefensePlay!.input)
    act(() => result.current.actions.finishDefensePlay(결과))
    expect(녹음.played[0]).toBe(20)
  })

  /**
   * 세이프 17 과 함성 60 은 **수비 결과를 넘겨야** 열리는 갈래다 — 한동안 타자편
   * (`useCareerSession`)만 넘겨 주어 팀 경기에서는 둘 다 안 났다.
   */
  it('안타인데 그 루로 송구가 도착했으면 세이프 17 이 난다 (0x51c14)', () => {
    const { result } = 띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT })
    act(() => result.current.actions.applyOutcome({ kind: '안타', bases: 1 }))

    // 송구 칸만 원본 세이프 조건("아웃 될 뻔했는데 살았다")에 맞춰 둔다 — 나머지는 진행기 그대로다
    const 결과 = {
      ...runDefensePlay(result.current.pendingDefensePlay!.input),
      throwBase: 2,
      throwArrivalTick: 10,
    }
    녹음.played.length = 0

    act(() => result.current.actions.finishDefensePlay(결과))
    expect(녹음.played).toContain(17)
  })

  it('깊은 타구가 아무도 못 잡고 떨어지면 함성 60 이 난다 (0x52b62)', () => {
    const { result } = 띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT })
    act(() => result.current.actions.applyOutcome({ kind: '안타', bases: 3 }))

    const 결과 = runDefensePlay(result.current.pendingDefensePlay!.input)
    expect(결과.caughtOnTheFly).toBe(false)
    녹음.played.length = 0

    act(() => result.current.actions.finishDefensePlay(결과))
    expect(녹음.played).toContain(60)
  })

  it('사람이 던지면 투구 순간 소리 12 가 먼저 난다 (0x3f378)', () => {
    const { result } = 띄우기({ playerSide: PLAYER_SIDE_LAST_BAT })
    // 우리가 후공이면 1회초는 우리 수비다
    expect(result.current.canPitch).toBe(true)
    녹음.played.length = 0

    act(() => result.current.actions.throwPitch({ typeNumber: 0, courseCell: 4, gaugeCell: 0 }))
    expect(녹음.played[0]).toBe(12)
  })
})

describe('`#` 투수 교체 화면 — "Time!" 22 (상태 0xb 진입 0x3af06)', () => {
  it('교체 화면을 열면 22 가 난다', () => {
    const { unmount } = render(
      <TeamGameScreen
        options={기본옵션}
        random={createSeededRandom(20100901)}
        onFinish={() => {}}
        onQuit={() => {}}
      />,
    )
    녹음.played.length = 0

    fireEvent.click(screen.getByRole('button', { name: '# 교체' }))

    expect(screen.getByText('투수 교체')).toBeTruthy()
    expect(녹음.played).toContain(PITCHER_CHANGE_SOUND)
    unmount()
  })

  it('경기 중 메뉴(*)에서는 22 가 안 난다 — 0x3c158 은 22 를 안 튼다', () => {
    const { unmount } = render(
      <TeamGameScreen
        options={기본옵션}
        random={createSeededRandom(20100901)}
        onFinish={() => {}}
        onQuit={() => {}}
      />,
    )
    녹음.played.length = 0

    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))

    expect(녹음.played).not.toContain(PITCHER_CHANGE_SOUND)
    unmount()
  })
})
