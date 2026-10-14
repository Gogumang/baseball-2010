import { describe, expect, it } from 'vitest'
import { recordMyBuntAttempt, startGame, summaryOf } from '@/features/play-game/model/gameFlow'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

describe('번트 수 G+0xf8 — 스윙 시작 0xa5fac 의 코드 11 (번트 판정을 받은 내 공)', () => {
  it('공마다 1 씩 더해 경기 요약의 reputationCounts.bunts 로 나간다', () => {
    let progress = startGame(createSeededRandom(1), 0, 9)
    progress = recordMyBuntAttempt(progress, { isRecorded: true })
    progress = recordMyBuntAttempt(progress, { isRecorded: true })
    expect(summaryOf(progress).reputationCounts.bunts).toBe(2)
  })

  it('게이트 0xa56dc(R, 타자, 1) 가 거짓(포스트시즌 · 국가대항전)이면 안 센다', () => {
    const progress = startGame(createSeededRandom(1), 0, 9)
    expect(recordMyBuntAttempt(progress, { isRecorded: false })).toBe(progress)
  })
})
