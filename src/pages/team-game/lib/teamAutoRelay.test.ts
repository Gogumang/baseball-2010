import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { FULL_PLAY_SETTINGS, MATCH_SETTING_KIND } from '@/features/play-team-game/model/matchSettings'
import { startTeamGame, stepAutoRelay } from '@/features/play-team-game/model/teamGameFlow'
import { teamRelayFiguresOf } from '@/pages/team-game/lib/teamAutoRelay'

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
      expect(그림.bases).toEqual([앞.bases.first, 앞.bases.second, 앞.bases.third])
      return
    }
    throw new Error('3아웃 틱을 못 찾았다')
  })
})
