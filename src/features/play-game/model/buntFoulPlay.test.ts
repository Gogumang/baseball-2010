import { describe, expect, it } from 'vitest'
import { resolveDefensePlay, startGame, startPlayerFoulPlay } from '@/features/play-game/model/gameFlow'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { inPlayCallSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import { isFairAngle } from '@/entities/batting/model/battedBallOutcome'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

describe('내 타석의 2스트라이크 번트 파울도 판을 돈다 — 판 끝 결과 코드 11 이 아웃 (0x9d5bc 9d5e2~9d600 · 0xae3e8 ae560)', () => {
  /** 원본 번트 실패 묶음(12~14)의 파울 각 패턴 */
  const 번트파울들 = [12, 13, 14].flatMap((code) =>
    (BATTED_BALL_PATTERNS[code] ?? []).filter((pattern) => !isFairAngle(pattern[0])).map((pattern) => ({ resultCode: code, pattern })),
  )

  it('낙구 전에 안 잡히면 11 — 타자 아웃(아웃 +1) · 콜 62, 잡히면 다른 파울처럼 뜬공 아웃 · 어느 쪽이든 파울(스트라이크)로 닫히지 않는다', () => {
    let 십일 = 0
    let 뜬공 = 0
    for (const { pattern, resultCode } of 번트파울들) {
      const random = createSeededRandom(7)
      const 시작 = startGame(random)
      const 붙듦 = startPlayerFoulPlay(시작, { pattern, resultCode }, random, { strikes: 2, buntKind: 1 })
      const pending = 붙듦.pendingDefensePlay
      if (pending === null) throw new Error('판이 안 섰다')
      expect(pending.strikes).toBe(2)
      expect(pending.buntKind).toBe(1)
      const result = runDefensePlay(pending)
      const 끝 = resolveDefensePlay(붙듦, result, random)
      expect(result.foulEnded).toBeUndefined()
      expect(끝.pendingDefensePlay).toBeNull()
      // 타석이 끝났다 — 판이 타자 아웃 하나를 내고(판 앞 자리로 안 돌아감) 경기 상태가 움직인다(동료 타석까지 이어 돈다)
      expect(result.advance.outsAdded).toBeGreaterThanOrEqual(1)
      expect(끝.game).not.toEqual(시작.game)
      if (result.buntFoulOut === true) {
        십일 += 1
        expect(result.caughtOnTheFly).toBe(false)
        expect(result.outcome?.kind).toBe('아웃')
        expect(inPlayCallSoundIdOf(pending.outcome, result)).toBe(62)
      } else {
        뜬공 += 1
        expect(result.caughtOnTheFly).toBe(true)
      }
    }
    expect(십일).toBeGreaterThan(0)
    expect(뜬공).toBeGreaterThan(0)
  })
})
