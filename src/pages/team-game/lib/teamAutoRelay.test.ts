import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { FULL_PLAY_SETTINGS, MATCH_SETTING_KIND } from '@/features/play-team-game/model/matchSettings'
import { startTeamGame, stepAutoRelay } from '@/features/play-team-game/model/teamGameFlow'
import { teamRelayEntryFiguresOf, teamRelayFiguresOf } from '@/pages/team-game/lib/teamAutoRelay'

const 옵션 = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
  settings: { ...FULL_PLAY_SETTINGS, kind: MATCH_SETTING_KIND.상세, value: 0 },
  liveAutoRelay: true,
} as const

describe('팀경기 0x21 운동장 그림의 값 (0x4258c 425bc~42812)', () => {
  it('공격 팀 = 주자 · 타자 팀 색, 수비 팀 = 투수 · 포수 팀 색 — 후공 경기 1회초는 상대가 친다', () => {
    const 시작 = startTeamGame(옵션, createSeededRandom(1))
    const 그림 = teamRelayFiguresOf({ progress: 시작, before: 시작.game, atBat: null })
    expect([그림.offenseTeam, 그림.defenseTeam]).toEqual([1, 0])
    expect(그림.bases).toEqual([false, false, false])
    expect(그림.pitcherAce).toBe(-1)
    expect(그림.catcherAce).toBe(-1)
    expect(그림.batter).not.toBeNull()
  })

  it('3아웃 타석 틱은 넘김(0xb6b6c)이 다음 틱이라 앞 반 이닝 그대로 — 공격 팀 · 루가 그 반 이닝 것이다', () => {
    const random = createSeededRandom(1)
    let current = startTeamGame(옵션, random)
    for (let step = 0; step < 200 && current.autoRelay != null; step += 1) {
      const 앞 = current.game
      current = stepAutoRelay(current, random)
      const 틱 = current.autoRelay?.ticks[0]
      if (틱 === undefined || 틱.atBat === null) continue
      if (틱.progress.game.half === 앞.half) continue
      const 그림 = teamRelayFiguresOf(틱)
      // 1회초 3아웃 — 아직 상대(1)가 공격
      expect(그림.offenseTeam).toBe(앞.half === '초' ? 1 : 0)
      // 간이 엔진은 아웃에 주자를 안 움직인다 — 타석 끝 루(도루만 더한 루)가 그대로 남는다
      const 끝 = 틱.atBat.basesAtEnd
      expect(그림.bases).toEqual([끝.first, 끝.second, 끝.third])
      return
    }
    throw new Error('3아웃 틱을 못 찾았다')
  })

  it('3아웃 타석 틱 — 그 타석 공 사이 도루로 민 루를 그린다(지우기 0xa9250 은 다음 틱 c2222)', () => {
    const 시작 = startTeamGame(옵션, createSeededRandom(1))
    const 앞 = { ...시작.game, outs: 2, bases: { first: true, second: false, third: false } }
    const 뒤 = { ...앞, half: 앞.half === '초' ? '말' as const : '초' as const, outs: 0, bases: { first: false, second: false, third: false } }
    const 그림 = teamRelayFiguresOf({
      progress: { ...시작, game: 뒤 },
      before: 앞,
      atBat: {
        ours: false, orderIndex: 0, outcome: { kind: '삼진' }, fouled: false, strikes: 3, balls: 0,
        basesAtEnd: { first: false, second: true, third: false },
        runnersAtEnd: { first: null, second: 8, third: null },
      },
    })
    expect(그림.bases).toEqual([false, true, false])
  })
})

// 주자 그림 0x79d10 — 주자 +0x9c ≠ −1 이면 [장면+0xf24]+0x1c(실린 마선수 그림 한 장). 갱신 0x48480 485a0 이 sim+0xa4(0xc0ee8 —
// 새 타자가 마선수면 그 번호, 아니면 −1) ≥ 0 일 때만 다시 싣는다
describe('팀경기 0x21 마선수 주자 (0x79d10 · 0x48480 의 sim+0xa4)', () => {
  function 마선수경기(aces: Record<number, number>) {
    const 시작 = startTeamGame(옵션, createSeededRandom(1))
    return {
      ...시작,
      opponentEntry: 시작.opponentEntry.map((entry, slot) => ({ ...entry, aceIndex: aces[slot] ?? -1 })),
    }
  }

  it('루 위 마선수 주자는 그 루만 표시하고, 이 틱 타자가 마선수가 아니면 앞 그림까지 실린 번호를 그대로 쓴다', () => {
    const 경기 = 마선수경기({ 8: 2 })
    const 앞 = { ...경기.game, bases: { first: false, second: true, third: false }, runners: { first: null, second: 8, third: null } }
    const 그림 = teamRelayFiguresOf({ progress: { ...경기, game: 앞, opponentOrderIndex: 0 }, before: 앞, atBat: null }, 4)
    expect(그림.aceRunners).toEqual([false, true, false])
    expect(그림.loadedRunnerAce).toBe(4)
  })

  it('이 틱 타자가 마선수면 그 그림으로 다시 싣는다 (sim+0xa4 ≥ 0)', () => {
    const 경기 = 마선수경기({ 0: 3 })
    const 그림 = teamRelayFiguresOf({ progress: { ...경기, opponentOrderIndex: 0 }, before: 경기.game, atBat: null }, 1)
    expect(그림.loadedRunnerAce).toBe(3)
  })

  it('중계 진입 0x47cc8 — 타자가 아니면 가장 앞선 마선수 주자 그림을 싣는다', () => {
    const 경기 = 마선수경기({ 7: 1, 8: 2 })
    const 앞 = { ...경기.game, bases: { first: true, second: true, third: false }, runners: { first: 8, second: 7, third: null } }
    const 그림 = teamRelayEntryFiguresOf({ ...경기, game: 앞, opponentOrderIndex: 0 })
    expect(그림.loadedRunnerAce).toBe(1)
    expect(그림.aceRunners).toEqual([true, true, false])
  })
})
