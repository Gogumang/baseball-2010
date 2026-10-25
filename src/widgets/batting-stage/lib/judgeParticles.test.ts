import { describe, expect, it } from 'vitest'
import { strikeoutJudgeParticlesOf } from '@/widgets/batting-stage/lib/judgeParticles'

describe('삼진 양끝 파티클 0x393b4 (394b2 · 394d2)', () => {
  it('삼진(애니 9)만 ptc 008 · img 11 을 왼끝, ptc 009 · img 12 를 오른끝(폭 240)에 판정 글자 y 로', () => {
    expect(strikeoutJudgeParticlesOf('삼진', 0)).toEqual([
      { id: 7, x: 0, y: 224, img: 11 },
      { id: 8, x: 240, y: 224, img: 12 },
    ])
  })

  it('다른 판정 글자는 안 쏜다', () => {
    for (const text of ['스트라이크', '볼', '볼넷', '아웃', '파울', '']) expect(strikeoutJudgeParticlesOf(text, 0)).toEqual([])
  })
})
