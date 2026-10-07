import { describe, expect, it } from 'vitest'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'
import { isFairAngle } from '@/entities/batting/model/battedBallOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { registerContact } from '@/entities/batting/model/battedContact'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import { runDefensePlay, type DefensePlayInput } from '@/features/defense-play/model/runDefensePlay'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

/** 파울 각 공 판 하나 — 세션들이 싣는 그대로(임시 결과 칸 = 뜬공 아웃에 쏜 공을 묶음) */
function 파울판(pattern: readonly [number, number, number, number], strikes: number, buntKind: number): DefensePlayInput {
  return {
    outcome: registerContact({ kind: '아웃', detail: '뜬공아웃' }, { pattern, resultCode: 12 }),
    trajectory: battedBallTrajectory(pattern),
    bases: EMPTY_BASES,
    outs: 0,
    strikes,
    buntKind,
    random: createSeededRandom(5),
  }
}

/** 원본 번트 실패 묶음(12)의 파울 각 패턴 중 낙구 전에 안 잡히는 한 장 */
const 번트파울 = BATTED_BALL_PATTERNS[12]!.find(
  (pattern) => !isFairAngle(pattern[0]) && runDefensePlay(파울판(pattern, 2, 1)).caughtOnTheFly === false,
)!

describe('2스트라이크 번트 파울 — 판 끝 결과 코드 11 (0x9d5bc 9d5e2~9d600)', () => {
  it('낙구 틱에 11 → vt90 머리 b373a 가 타자주자를 끝내고 아웃 +1 · 사건 0xd(0x51b20 → 0xa7d0c) — 타수 있는 아웃', () => {
    const played = runDefensePlay(파울판(번트파울, 2, 1))

    expect(played.log.some((line) => line.includes('판 끝 결과 코드 11'))).toBe(true)
    expect(played.buntFoulOut).toBe(true)
    expect(played.foulEnded).toBeUndefined()
    expect(played.outcome).toEqual({ kind: '아웃', detail: '땅볼아웃' })
    expect(played.advance.outsAdded).toBe(1)
    expect(played.runnerFates[0]).toEqual({ fromBase: 0, scored: false, retired: true })
  })

  it('스트라이크 ≤ 1 이거나 번트가 아니면 같은 공이 파울(7)로 닫힌다 — 스트라이크 +1 은 ≤ 1 일 때만', () => {
    const 일스트 = runDefensePlay(파울판(번트파울, 1, 1))
    expect(일스트.foulEnded).toBe(true)
    expect(일스트.foulStrikes).toBe(2)
    expect(일스트.buntFoulOut).toBeUndefined()

    const 스윙 = runDefensePlay(파울판(번트파울, 2, 0))
    expect(스윙.foulEnded).toBe(true)
    expect(스윙.foulStrikes).toBe(2)
    expect(스윙.advance.outsAdded).toBe(0)
  })
})
