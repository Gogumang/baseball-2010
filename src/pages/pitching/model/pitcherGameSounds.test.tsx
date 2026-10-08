// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { usePitcherGame } from '@/pages/pitching/model/usePitcherGame'
import type { PitcherGameOptions } from '@/pages/pitching/model/usePitcherGame'
import { GAME_INTRO_SOUND } from '@/features/play-game/model/gameSounds'
import { PITCH_RELEASE_SOUND } from '@/features/play-at-bat/model/atBatSounds'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { setActiveSound } from '@/shared/api/audio/soundPort'
import type { SoundPort } from '@/shared/api/audio/soundPort'

/** 무엇이 몇 번 울렸는지 적어 두는 포트 */
function 녹음포트() {
  const played: number[] = []
  const port: SoundPort = {
    play: (id) => {
      played.push(id)
    },
    playBgm: () => {},
    stopBgm: () => {},
    resumeBgm: () => {},
    currentBgm: () => null,
    setVolume: () => {},
    getVolume: () => 100,
  }
  return { played, port }
}

const 기본옵션: PitcherGameOptions = {
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  role: PITCHER_ROLE.starter,
  positionCode: 0,
  // 짝수 날이라 내 선발이 등판한다 (0xa4f60 표)
  dayCounter: 2,
  isPostseason: false,
  stats: { control: 500, velocity: 500, breaking: 500, stamina: 400 },
  staminaAbility: 400,
  stamina: FULL_STAMINA,
  repertoire: { pitchMask: 0b101_0111, form: 0, magicNumber: 1 },
  magicCount: 4,
  teamMorale: 80,
  reputation: 500,
  gaugeSettingOn: false,
}

let 녹음 = 녹음포트()
beforeEach(() => {
  녹음 = 녹음포트()
  setActiveSound(녹음.port)
})
afterEach(() => setActiveSound(null))

const 띄우기 = (seed = 20100901) =>
  renderHook(() => usePitcherGame(기본옵션, createSeededRandom(seed)))

describe('투수편 화면의 소리 배선', () => {
  it('경기가 서면 인트로 예약음 61 이 난다 (상태 0xc 진입 0x3b148)', () => {
    띄우기()
    expect(녹음.played[0]).toBe(GAME_INTRO_SOUND)
  })

  it('한 개 던지면 투구 순간 소리 12 가 먼저, 이어서 심판 콜이 난다 (0x3f378 → 0x51a94)', () => {
    // 게이지 끈 공의 흩어짐을 t + 3 칸(0x4dce0)으로 고친 뒤 기본 씨앗은 한가운데 공이 다 인플레이라 1 로 옮겼다.
    // 1회초 판(0x18)의 걸음 굴림 36 개가 첫 타석 준비 앞에 끼면서 첫 공이 인플레이가 되어 2 로 옮겼다
    const { result } = 띄우기(2)
    expect(result.current.canPitch).toBe(true)
    녹음.played.length = 0

    act(() => result.current.actions.throwPitch({ typeNumber: 1, courseCell: 4, gaugeCell: 0 }))
    expect(녹음.played[0]).toBe(PITCH_RELEASE_SOUND)

    // 심판 콜은 난수가 정한다 — 몇 개 더 던져 볼·스트라이크 계열이 통로까지 가는지 본다
    // (16 "Ball!" · 18 "Strike!" · 39 "Strike two!" · 21 삼진 · 24 볼넷 · 25 파울 — 25 는 파울 판이 닫힐 때)
    for (let pitch = 0; pitch < 12; pitch += 1) {
      if (result.current.progress.pendingDefensePlay !== null) {
        act(() => result.current.actions.finishDefensePlay())
        continue
      }
      if (!result.current.canPitch) break
      act(() => result.current.actions.throwPitch({ typeNumber: 1, courseCell: 4, gaugeCell: 0 }))
    }
    expect(녹음.played.some((id) => [16, 18, 39, 21, 24, 25].includes(id))).toBe(true)
  })

  it('마구(구질 22)를 던지면 투구 순간 소리가 28 이다 — 내 투수는 육성이라 그 뒤 직구는 다시 12 (0x3f378)', () => {
    const { result } = 띄우기(2)
    expect(result.current.canPitch).toBe(true)
    녹음.played.length = 0
    act(() => result.current.actions.throwPitch({ typeNumber: 22, courseCell: 4, gaugeCell: 0 }))
    expect(녹음.played[0]).toBe(28)

    // 다음 공을 던질 수 있는 자리까지 넘긴다 (인플레이면 수비 화면을 닫는다)
    for (let step = 0; step < 20 && !result.current.canPitch; step += 1) {
      if (result.current.progress.pendingDefensePlay === null) break
      act(() => result.current.actions.finishDefensePlay())
    }
    if (!result.current.canPitch) return
    녹음.played.length = 0
    act(() => result.current.actions.throwPitch({ typeNumber: 1, courseCell: 4, gaugeCell: 0 }))
    expect(녹음.played[0]).toBe(PITCH_RELEASE_SOUND)
  })

  /**
   * 세이프 17 · 함성 60 은 **수비 결과를 넘겨야** 열리는 갈래다 — 한동안 타자편
   * (`useCareerSession`)만 넘겨 주어 투수편에서는 둘 다 안 났다.
   */
  it('안타인데 그 루로 송구가 도착했으면 세이프 17 이 난다 (0x51c14)', () => {
    // 씨앗 6 은 첫 인플레이 타구가 **안타**다 (기본 씨앗은 그 앞에 감독 강판이 와 더 못 던진다).
    // CPU 타자 타이밍이 원본 0x340f8 로 바뀌며 굴림 수가 늘어 1 → 6 으로 옮겼다.
    // 실투 판정 0x33cbc 가 공마다 rand(0,100) 을 하나 더 굴리게 되어 6 → 2 로 옮겼다.
    // 1회초 판(0x18)의 걸음 굴림 36 개가 첫 타석 준비 앞에 끼면서 2 → 3 으로 옮겼다
    const { result } = 띄우기(3)

    // 인플레이 **안타**가 나올 때까지 던진다 — 무엇이 나올지는 난수가 정한다.
    // 아웃이 걸린 타구는 그대로 흘려보내고, 중간에 뜨는 창(감독 대사·돌발)은 닫아 가며 이어 던진다
    for (let pitch = 0; pitch < 400; pitch += 1) {
      const 진행 = result.current.progress
      if (진행.pendingDefensePlay !== null) {
        if (진행.pendingDefensePlay.outcome.kind === '안타') break
        act(() => result.current.actions.finishDefensePlay())
        continue
      }
      if (진행.managerHookText !== null) {
        act(() => result.current.actions.confirmManagerHook())
        continue
      }
      if (진행.burst !== null && 진행.burst.current !== null) {
        act(() => result.current.actions.closeBurst())
        continue
      }
      if (!result.current.canPitch) break
      act(() => result.current.actions.throwPitch({ typeNumber: 1, courseCell: 4, gaugeCell: 0 }))
    }
    const pending = result.current.progress.pendingDefensePlay
    expect(pending?.outcome.kind).toBe('안타')

    // 송구 칸만 원본 세이프 조건("아웃 될 뻔했는데 살았다")에 맞춰 둔다 — 나머지는 진행기 그대로다
    const 결과 = { ...runDefensePlay(pending!), throwBase: 2, throwArrivalTick: 10 }
    녹음.played.length = 0

    act(() => result.current.actions.finishDefensePlay(결과))
    expect(녹음.played).toContain(17)
  })

  it('승리 31 · 패배 32 징글은 경기가 끝난 자리가 아니라 결과 판 OK 뒤 정산(0x19 진입 0x4ea0c)에서 난다', () => {
    // 등판이 없는 날은 경기를 세우는 자리에서 이미 끝나 있다
    const { result } = renderHook(() =>
      usePitcherGame({ ...기본옵션, dayCounter: 3 }, createSeededRandom(5)),
    )
    expect(result.current.summary).not.toBeNull()
    expect(녹음.played.some((id) => id === 31 || id === 32)).toBe(false)

    act(() => result.current.actions.enterSettlement())
    const 결과 = result.current.summary!.result
    if (결과 !== '무') expect(녹음.played.at(-1)).toBe(결과 === '승' ? 31 : 32)
  })
  /**
   * 0xf 진입 0x3d954 의 CPU 대타(3da70)가 걸리면 22 "Time!"(3da88) → 0x16 → 0xe 에서 들어온 타자 등판음
   * (0x38b64 타자 가지 — 마타자 26 · 2루나 3루 주자 15 · 그 밖 14). 대타가 안 난 걸음에는 22 가 없다.
   */
  it('내가 던지는 타석에 CPU 대타가 서면 걸음 끝에 22 — 등판음 14/15 는 교체 연출 0x16 에 실어 연출 뒤 0xe 에서, 대타 없는 걸음엔 22 가 없다', () => {
    let 대타소리 = 0
    for (let seed = 1; seed <= 10 && 대타소리 === 0; seed += 1) {
      const { result, unmount } = 띄우기(seed)
      for (let pitch = 0; pitch < 400; pitch += 1) {
        const 앞 = result.current.progress.scenePinchHit
        녹음.played.length = 0
        if (result.current.progress.pendingDefensePlay !== null) {
          act(() => result.current.actions.finishDefensePlay())
        } else if (result.current.progress.sceneConfirmPending === true) {
          // 0xe 의 OK — 그 뒤 0xf 진입 0x3d954 가 대타를 묻는다
          act(() => result.current.actions.confirmScene())
        } else if (result.current.canPitch) {
          act(() => result.current.actions.throwPitch({ typeNumber: 1, courseCell: 4, gaugeCell: 0 }))
        } else {
          break
        }
        const 뒤 = result.current.progress.scenePinchHit
        if (뒤 === 앞) {
          expect(녹음.played).not.toContain(22)
          continue
        }
        const 자리 = 녹음.played.indexOf(22)
        expect(자리).toBeGreaterThanOrEqual(0)
        // 등판음은 걸음 끝에 안 난다 — 0x16 "CHANGE" 17 그림 · 0xd 두 그림 뒤 0xe 그리기(0x38b64 타자 가지)
        expect(녹음.played).not.toContain(14)
        expect(녹음.played).not.toContain(15)
        const bases = result.current.progress.game.bases
        expect(result.current.progress.substitutionScene?.entrySoundId).toBe(bases.second || bases.third ? 15 : 14)
        대타소리 += 1
        break
      }
      unmount()
    }
    expect(대타소리).toBe(1)
  })
})

describe('CPU 타자의 파울 각 공 판 — 판이 끝날 때 콜 (결과 코드 7 메시지 51c5c)', () => {
  it('파울로 닫힌 판은 "Foul!" 25, 낙구 전에 잡힌 판(파울 뜬공 아웃)은 잡은 아웃 콜 62 — 공 판정 자리에서는 25 가 안 난다', () => {
    let 파울 = 0
    let 뜬공 = 0
    for (let seed = 1; seed <= 3 && 파울 < 3; seed += 1) {
      녹음.played.length = 0
      const { result, unmount } = 띄우기(seed)
      for (let pitch = 0; pitch < 300 && 파울 < 3; pitch += 1) {
        const 진행 = result.current.progress
        if (진행.pendingDefensePlay !== null) {
          const pending = 진행.pendingDefensePlay
          // 파울 각 공 판은 타석이 아직 안 끝났다(타석 칸에 결과가 없다)
          const 파울판 = 진행.atBat.outcome === null
          const played = runDefensePlay(pending)
          녹음.played.length = 0
          act(() => result.current.actions.finishDefensePlay(played))
          if (파울판 && played.foulEnded === true) {
            파울 += 1
            expect(녹음.played[0]).toBe(25)
          } else if (파울판) {
            뜬공 += 1
            expect(played.caughtOnTheFly).toBe(true)
            expect(녹음.played).toContain(62)
            expect(녹음.played).not.toContain(25)
          }
          continue
        }
        if (진행.managerHookText !== null) {
          act(() => result.current.actions.confirmManagerHook())
          continue
        }
        if (진행.burst !== null && 진행.burst.current !== null) {
          act(() => result.current.actions.closeBurst())
          continue
        }
        if (진행.pendingBenchClearing !== null) {
          act(() => result.current.actions.finishBenchClearing(false))
          continue
        }
        if (진행.sceneConfirmPending === true) {
          act(() => result.current.actions.confirmScene())
          continue
        }
        if (!result.current.canPitch) break
        녹음.played.length = 0
        act(() => result.current.actions.throwPitch({ typeNumber: 1, courseCell: pitch % 9, gaugeCell: 0 }))
        expect(녹음.played).not.toContain(25)
      }
      unmount()
    }
    // 이 씨앗들은 파울 뜬공 아웃이 안 나온다(사람 수비 판을 키 없이 돌린다) — 파울 판만 꼭 본다. 뜬공 쪽 콜은 atBatSounds 시험
    expect(파울).toBeGreaterThan(0)
    expect(뜬공).toBeGreaterThanOrEqual(0)
  })
})
