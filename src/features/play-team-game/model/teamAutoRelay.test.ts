import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { FULL_PLAY_SETTINGS, MATCH_SETTING_KIND } from '@/features/play-team-game/model/matchSettings'
import {
  isHumanTurn,
  resumeTeamGame,
  runAutoProgress,
  startTeamGame,
  stepAutoRelay,
  stopAutoRelay,
  summaryOf,
  type TeamGameOptions,
  type TeamGameProgress,
} from '@/features/play-team-game/model/teamGameFlow'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 기본옵션: TeamGameOptions = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
}
/** 사람이 한 타석도 안 잡는 설정 */
const 전부자동 = { ...FULL_PLAY_SETTINGS, kind: MATCH_SETTING_KIND.상세, value: 0 } as const

/** 중계가 끝날 때까지 한 걸음씩 — 걸음마다 틱 수를 센다 */
function 끝까지중계(progress: TeamGameProgress, random: RandomPort) {
  let current = progress
  const 걸음틱: number[] = []
  for (let step = 0; step < 2000 && current.autoRelay != null; step += 1) {
    current = stepAutoRelay(current, random)
    if (current.autoRelay != null) 걸음틱.push(current.autoRelay.ticks.length)
  }
  return { current, 걸음틱 }
}

describe('자동진행 중계(상태 0x21)를 화면이 한 틱씩 돌린다 — 갱신 0x48480 의 0xc2198 → 0xc262c', () => {
  it('설정이 자동인 이닝은 중계에 멈춰 서고, 끝까지 한 걸음씩 돌리면 한꺼번에 굴린 경기와 같다 (굴림 차례 같음)', () => {
    const 한번에Random = createSeededRandom(1)
    const 한번에 = startTeamGame({ ...기본옵션, settings: 전부자동 }, 한번에Random)
    expect(한번에.game.isFinished).toBe(true)

    const random = createSeededRandom(1)
    const 시작 = startTeamGame({ ...기본옵션, settings: 전부자동, liveAutoRelay: true }, random)
    expect(시작.game.isFinished).toBe(false)
    expect(시작.autoRelay?.ticks).toEqual([])
    expect(isHumanTurn(시작)).toBe(false)

    const { current, 걸음틱 } = 끝까지중계(시작, random)
    expect(current.game.isFinished).toBe(true)
    expect(current.autoRelay ?? null).toBeNull()
    // 걸음마다 0xc262c 한 번 — 교체 틱이든 타석 틱이든 하나
    expect(걸음틱.every((count) => count === 1)).toBe(true)
    const 요약 = summaryOf(current)
    const 한번에요약 = summaryOf(한번에)
    expect([요약.ourScore, 요약.opponentScore]).toEqual([한번에요약.ourScore, 한번에요약.opponentScore])
    expect(요약.gameRecord).toEqual(한번에요약.gameRecord)
    expect(random.next()).toBe(한번에Random.next())
  })

  it('3아웃을 낸 타석 다음 걸음 첫 틱이 반 이닝 넘김(0xb6b6c — CHANGE 대기를 거는 틱)이다', () => {
    const random = createSeededRandom(1)
    let current = startTeamGame({ ...기본옵션, settings: 전부자동, liveAutoRelay: true }, random)
    const 넘김: { 앞: string; 틱: boolean }[] = []
    while (current.autoRelay != null) {
      const 앞 = `${current.game.inning}${current.game.half}`
      const 앞대기 = current.autoRelay.flipPending
      current = stepAutoRelay(current, random)
      if (current.autoRelay == null) break
      넘김.push({ 앞, 틱: current.autoRelay.ticks[0]?.halfFlipped === true })
      expect(current.autoRelay.ticks[0]?.halfFlipped === true).toBe(앞대기)
    }
    // 1회초 첫 타석 앞에는 넘김이 없다 — 3아웃 뒤 걸음마다 한 번
    expect(넘김[0]?.틱).toBe(false)
    expect(넘김.filter((entry) => entry.틱).length).toBeGreaterThanOrEqual(16)
  })

  it('타석 틱은 그 틱 앞 경기 · 타자 · 끝 카운트를 싣고, 교체 틱은 타석이 없다', () => {
    const random = createSeededRandom(1)
    const 시작 = startTeamGame({ ...기본옵션, settings: 전부자동, liveAutoRelay: true }, random)
    const 한걸음 = stepAutoRelay(시작, random)
    const 틱 = 한걸음.autoRelay?.ticks.at(-1)
    expect(틱?.atBat).not.toBeNull()
    expect(틱?.before).toEqual(시작.game)
    expect(틱?.progress.autoRelay).toBeNull()
  })

  it('CLR 중단(예) — sim+0x9f = 1: 다음 걸음의 0xc2198 이 거짓이라 사람 타석이 서고, 설정이 자동이어도 남은 경기는 사람이 잡는다', () => {
    const random = createSeededRandom(1)
    let current = startTeamGame({ ...기본옵션, settings: 전부자동, liveAutoRelay: true }, random)
    for (let step = 0; step < 5; step += 1) current = stepAutoRelay(current, random)
    const 멈춤 = stopAutoRelay(current)
    expect(멈춤.autoProgressFlag).toBe('stopped')
    // 중계 밖에서는 아무 일도 없다
    expect(stopAutoRelay({ ...current, autoRelay: null })).toEqual({ ...current, autoRelay: null })

    const 사람 = stepAutoRelay(멈춤, random)
    expect(사람.autoRelay ?? null).toBeNull()
    expect(isHumanTurn(사람)).toBe(true)
    expect(사람.atBatPrepared).toBe(true)
    // 이어하기(장면 초기화 0xc0e60)도 sim+0x9f 를 되살린다
    expect(resumeTeamGame(사람, createSeededRandom(2)).autoProgressFlag).toBe('stopped')
  })

  it('교체 틱(0xc262c 의 c266c — 공 없이 돌아감)도 한 걸음이라, 그 뒤 CLR 로 멈추면 그 타석은 간이 엔진이 안 굴린다', () => {
    const random = createSeededRandom(1)
    let current = startTeamGame({ ...기본옵션, settings: 전부자동, liveAutoRelay: true }, random)
    // 씨앗 1 은 36 걸음째(0-기준 35)가 교체 틱이다
    for (let step = 0; step < 36; step += 1) current = stepAutoRelay(current, random)
    const 교체틱 = current.autoRelay?.ticks
    expect(교체틱).toHaveLength(1)
    expect(교체틱?.[0]?.atBat).toBeNull()
    const 앞경기 = current.game
    const 사람 = stepAutoRelay(stopAutoRelay(current), random)
    expect(사람.autoRelay ?? null).toBeNull()
    expect(isHumanTurn(사람)).toBe(true)
    // 그 타석은 아직 안 굴렀다 — 같은 반 이닝 · 같은 아웃 · 같은 점수
    expect([사람.game.inning, 사람.game.half, 사람.game.outs]).toEqual([앞경기.inning, 앞경기.half, 앞경기.outs])
    expect([사람.game.ourScore, 사람.game.opponentScore]).toEqual([앞경기.ourScore, 앞경기.opponentScore])
  })

  it('30G 자동진행 — sim+0xa0 = 1 로 중계에 들어서고, 일반·시즌은 경기 끝까지 · 대전은 7회 앞에서 사람에게 넘긴다', () => {
    for (const mode of [2, 8] as const) {
      const 한번에Random = createSeededRandom(20100901)
      const 한번에 = runAutoProgress(startTeamGame({ ...기본옵션, mode }, 한번에Random), 한번에Random)

      const random = createSeededRandom(20100901)
      const 들어섬 = runAutoProgress(startTeamGame({ ...기본옵션, mode, liveAutoRelay: true }, random), random)
      expect(들어섬.autoProgressFlag).toBe('running')
      expect(들어섬.autoRelay).not.toBeNull()
      const { current } = 끝까지중계(들어섬, random)
      expect(current.game.isFinished).toBe(한번에.game.isFinished)
      expect(current.game.inning).toBe(한번에.game.inning)
      expect([current.game.ourScore, current.game.opponentScore]).toEqual([한번에.game.ourScore, 한번에.game.opponentScore])
      expect(random.next()).toBe(한번에Random.next())
    }
  })
})
