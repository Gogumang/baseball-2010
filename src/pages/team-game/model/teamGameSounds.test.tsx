// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { useTeamGame } from '@/pages/team-game/model/useTeamGame'
import { TeamGameScreen } from '@/pages/team-game/ui/TeamGameScreen'
import type { TeamGameOptions } from '@/pages/team-game/model/useTeamGame'
import { PITCHER_CHANGE_SOUND, stepSoundIdsOf } from '@/pages/team-game/model/teamGameSounds'
import { runDefensePlay, type DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { runLiveRunnerPlayWithoutKeys } from '@/features/defense-play/model/liveRunnerPlay'
import { GAME_INTRO_SOUND, HALF_INNING_SOUND } from '@/features/play-game/model/gameSounds'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { isPickoffPlayResult } from '@/features/defense-play/model/pickoffPlay'
import { pitchSlotsFor } from '@/features/play-team-game/model/teamGameFlow'
import { setActiveSound } from '@/shared/api/audio/soundPort'
import { FULL_PLAY_SETTINGS, MATCH_SETTING_KIND } from '@/features/play-team-game/model/matchSettings'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import { SCENE_CONFIRM_READY_FRAMES } from '@/features/play-game/model/useSceneConfirm'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/**
 * 경기 시작 인트로(상태 0xc)와 1회초 판(0x18) — 첫 사람 타석 앞에 서면 OK 로 넘긴다.
 * 둘 다 경기 화면(PixelScreen)을 통째로 덮으므로 '메뉴' 소프트키가 없다.
 */
const 판닫기 = () => {
  for (let 번 = 0; 번 < 2; 번 += 1) {
    if (screen.queryByRole('button', { name: '메뉴' }) !== null) return
    fireEvent.keyDown(window, { key: 'Enter' })
  }
}

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

  it('반 이닝이 바뀌어도 걸음 소리에는 13 이 없다 — 판이 설 때만 화면이 틱 2 에 낸다 (0x4f7ac)', () => {
    expect(stepSoundIdsOf(진행('초', 1), 진행('말', 1))).not.toContain(HALF_INNING_SOUND)
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

  it('사람 대타를 확정하면 교체 연출 0x16 을 싣고 걸음 끝 소리는 없다 — 등판음 14 는 연출 뒤 0xe 에서 (0x38b64 타자 가지 38cd4)', () => {
    const { result } = 띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT })
    녹음.played.length = 0

    act(() => result.current.actions.pinchHit(result.current.benchBatters[0]!))

    expect(녹음.played).toEqual([])
    // 시즌 명단 벤치 첫 칸은 마선수가 아니고, 1회 첫 타석이라 루가 비었다 → 14
    expect(result.current.progress.substitutionScene).toMatchObject({ serial: 1, incomingIsAce: false, entrySoundId: 14 })
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
    vi.useFakeTimers()
    const { unmount } = render(
      <TeamGameScreen
        options={기본옵션}
        random={createSeededRandom(20100901)}
        onFinish={() => {}}
        onQuit={() => {}}
      />,
    )
    판닫기()
    // 상태 0xe 의 OK — 교체 창은 OK 뒤(0xf)에 열린다
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * SCENE_CONFIRM_READY_FRAMES))
    fireEvent.keyDown(window, { key: 'Enter' })
    녹음.played.length = 0

    fireEvent.click(screen.getByRole('button', { name: '# 교체' }))

    expect(screen.getByText('투수 교체')).toBeTruthy()
    expect(녹음.played).toContain(PITCHER_CHANGE_SOUND)
    unmount()
    vi.useRealTimers()
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
    판닫기()
    녹음.played.length = 0

    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))

    expect(녹음.played).not.toContain(PITCHER_CHANGE_SOUND)
    unmount()
  })
})

describe('견제 판정 콜 — 세이프면 늘 17 (0x51c14 의 종류 4·5 갈래)', () => {
  it('사람 투수 견제: 주자 있는 루로 3·1·7 을 누르면 견제 판을 붙들고(실시간 — 송구 키 +0x160), 판이 끝나면 17 이 난다', () => {
    const { result } = 띄우기()
    // 주자가 나갈 때까지 던진다 (볼넷·안타 — 인플레이면 수비 화면을 끝까지 돌린다)
    for (let pitch = 0; pitch < 500; pitch += 1) {
      const { progress } = result.current
      if (result.current.pendingDefensePlay !== null) {
        act(() => result.current.actions.finishDefensePlay())
        continue
      }
      if (progress.pendingRunnerPlay != null) {
        act(() => result.current.actions.finishRunnerPlay())
        continue
      }
      if (result.current.canBat) {
        // 우리 공격으로 넘어갔으면 아웃으로 넘겨 다시 수비로 돌아온다
        act(() => result.current.actions.applyOutcome({ kind: '삼진' }))
        continue
      }
      if (!result.current.canPitch) break
      if (progress.game.bases.first || progress.game.bases.second || progress.game.bases.third) break
      const typeNumber = pitchSlotsFor(progress).find((slot) => slot.typeNumber !== 0)?.typeNumber ?? 1
      act(() => result.current.actions.throwPitch({ typeNumber, courseCell: 4, gaugeCell: 0 }))
    }
    expect(result.current.canPitch).toBe(true)
    const bases = result.current.progress.game.bases
    const key = bases.first ? '3' : bases.second ? '1' : '7'
    const 전 = result.current.progress
    녹음.played.length = 0

    act(() => result.current.actions.pickoff(key))

    // 판은 수비 화면이 돌린다 — 아직 콜도 재생 칸도 없다
    expect(result.current.progress.pendingRunnerPlay?.kind).toBe('pickoff')
    expect(result.current.canPitch).toBe(false)
    expect(녹음.played).toEqual([])
    let played: DefensePlayResult | undefined
    act(() => {
      const pending = result.current.progress.pendingRunnerPlay
      if (pending == null) return
      played = runLiveRunnerPlayWithoutKeys(pending)
      result.current.actions.finishRunnerPlay(played)
    })

    expect(result.current.progress.pendingRunnerPlay ?? null).toBeNull()
    // 이미 실시간으로 본 판이라 재생 칸에 다시 안 넣는다
    expect(result.current.progress.lastDefensePlay).toBe(전.lastDefensePlay)
    expect(isPickoffPlayResult(played ?? null)).toBe(true)
    expect(result.current.progress.pitchCount).toBe(전.pitchCount)
    if (played !== undefined && isPickoffPlayResult(played) && !played.errantThrow) expect(녹음.played).toEqual([17])
  })

  it('CPU 견제: 사람이 칠 차례에 주자 있는 루로 걸리면 17 이 나고 타석은 그대로다', () => {
    const { result } = 띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT })
    act(() => result.current.actions.applyOutcome({ kind: '안타', bases: 1 }))
    act(() => result.current.actions.finishDefensePlay())
    expect(result.current.canBat).toBe(true)
    const bases = result.current.progress.game.bases
    const base = bases.first ? 1 : bases.second ? 2 : 3
    const 전 = result.current.progress
    녹음.played.length = 0

    act(() => result.current.actions.cpuPickoff(base))

    const play = result.current.progress.lastDefensePlay
    expect(isPickoffPlayResult(play)).toBe(true)
    expect(result.current.progress.game.battingOrderIndex).toBe(전.game.battingOrderIndex)
    if (isPickoffPlayResult(play) && !play.errantThrow) expect(녹음.played).toEqual([17])
  })
})

describe('경기 결과 징글 — 정산 0x19 진입(0x4ea0c)', () => {
  it('승리 31 · 패배 32 는 경기가 끝난 자리가 아니라 결과 판 OK 뒤 정산(enterSettlement)에서 난다', () => {
    // 사람이 한 타석도 안 잡는 설정 — 첫 타석부터 자동진행 중계(0x21)가 경기 끝까지 돈다
    const { result } = 띄우기({ settings: { ...FULL_PLAY_SETTINGS, kind: MATCH_SETTING_KIND.상세, value: 0 } })
    while (result.current.progress.autoRelay != null) act(() => void result.current.actions.stepAutoRelay())
    expect(result.current.summary).not.toBeNull()
    expect(녹음.played.some((id) => id === 31 || id === 32)).toBe(false)

    act(() => result.current.actions.enterSettlement())
    const 결과 = result.current.summary!.result
    if (결과 !== '무') expect(녹음.played.at(-1)).toBe(결과 === '승' ? 31 : 32)
  })
})
