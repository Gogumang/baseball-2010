// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { rollDerbySceneStart, useHomeRunDerby } from '@/pages/home-run-derby/model/useHomeRunDerby'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { teamPitchers } from '@/entities/team/model/teamRoster'

/** 굴림을 적고 정해 둔 값을 돌려주는 가짜 — `value(lo, hi)` 가 없으면 lo */
function 기록난수(value: (lo: number, hi: number) => number = (lo, hi) => Math.min(lo, hi)) {
  const calls: [number, number][] = []
  const random: RandomPort = {
    rand: (lo, hi) => {
      calls.push([lo, hi])
      return value(lo, hi)
    },
    rand9d: () => 0,
  }
  return { random, calls }
}

describe('단계 0 상대 투수 — 0x39fdc 모드 7 갈래 3a454 의 상대 팀 v · 투수 줄 2', () => {
  it('rand(0, 9) 가 내 팀이면 9 로 바꾼다 (3a45a)', () => {
    expect(rollDerbySceneStart(기록난수((lo, hi) => (lo === 0 && hi === 9 ? 4 : lo)).random, 4).opponentTeamId).toBe(9)
    expect(rollDerbySceneStart(기록난수((lo, hi) => (lo === 0 && hi === 9 ? 4 : lo)).random, 3).opponentTeamId).toBe(4)
    expect(rollDerbySceneStart(기록난수((lo, hi) => (lo === 0 && hi === 9 ? 4 : lo)).random).opponentTeamId).toBe(4)
  })

  it('단계 0 투수는 그 팀의 투수 줄 2 다', () => {
    const v = rollDerbySceneStart(createSeededRandom(7), 2).opponentTeamId
    const rendered = renderHook(() => useHomeRunDerby({ bestDistance: 0, random: createSeededRandom(7), myTeamId: 2 }))
    expect(rendered.result.current.pitcher.ace).toBeNull()
    expect(rendered.result.current.pitcher.name).toBe(teamPitchers(v)[2]!.name)
  })
})
