import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { startGame, teamBatterNameAt } from '@/features/play-game/model/gameFlow'
import { RELAY_RESULT_WORDS } from '@/entities/mission/model/missionAutoRelay'
import { gameAutoRelayStepsOf } from '@/pages/game/lib/gameAutoRelay'

describe('나리 타자편 자동진행 중계 칸 (상태 0x21 — 0xc262c 한 번마다 한 칸, 그리기 0x4258c 의 모드 4 몫)', () => {
  it('경기 시작 자동진행의 틱마다 한 칸 — 타석 칸은 친 타자 이름 + 결과 낱말, 반 이닝을 끝낸 타석은 그 반 이닝 그대로 아웃 3', () => {
    const progress = startGame(createSeededRandom(20100901))
    const ticks = progress.autoRelay?.ticks ?? []
    expect(ticks.length).toBeGreaterThan(0)
    const steps = gameAutoRelayStepsOf(ticks, '테스트')
    expect(steps).toHaveLength(ticks.length)
    ticks.forEach((tick, index) => {
      const step = steps[index]
      expect(step.offenseSide).toBe(tick.game.half === '초' ? 0 : 1)
      if (tick.atBat === null) {
        expect(step.line).toBeNull()
        return
      }
      if (step.line === null) return
      const name = teamBatterNameAt(tick.progress, tick.offenseOurs, tick.atBat.rosterSlot)
      expect(step.line.startsWith(`${name} `)).toBe(true)
      expect(RELAY_RESULT_WORDS.some((word) => step.line?.endsWith(word))).toBe(true)
    })
    // 반 이닝이 바뀌는 자리 바로 앞 칸은 앞 반 이닝의 아웃 3 이다
    for (let index = 1; index < steps.length; index += 1) {
      if (steps[index].offenseSide !== steps[index - 1].offenseSide) expect(steps[index - 1].cards?.outs).toBe(3)
    }
  })
})
