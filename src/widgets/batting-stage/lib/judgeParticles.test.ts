import { describe, expect, it } from 'vitest'
import { strikeoutJudgeParticlesOf } from '@/widgets/batting-stage/lib/judgeParticles'
import { judgeTextOf } from '@/widgets/batting-stage/lib/stageText'

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

  it('판정 v 0x9d57c — 타석을 끝낸 스트라이크는 삼진(v 5) · 볼은 볼넷(v 3) 글자라 실제 삼진 공에서 쏜다 (r204)', () => {
    expect(judgeTextOf({ kind: '스트라이크', isSwinging: true }, true)).toBe('삼진')
    expect(judgeTextOf({ kind: '스트라이크', isSwinging: false }, true)).toBe('삼진')
    expect(judgeTextOf({ kind: '볼' }, true)).toBe('볼넷')
    expect(judgeTextOf({ kind: '스트라이크', isSwinging: true }, false)).toBe('헛스윙')
    expect(judgeTextOf({ kind: '볼' }, false)).toBe('볼')
    expect(judgeTextOf({ kind: '사구' }, true)).toBe('몸에 맞는 공')
    expect(strikeoutJudgeParticlesOf(judgeTextOf({ kind: '스트라이크', isSwinging: false }, true), 0)).toHaveLength(2)
  })

  it('낫아웃(0x3dfac 3e0aa 가 v 를 지움)이면 판정 글자도 양끝 파티클도 없다 — 지운 칸은 삼진 공에만 선다 (r213)', () => {
    expect(judgeTextOf({ kind: '스트라이크', isSwinging: true }, true, true)).toBe('')
    expect(strikeoutJudgeParticlesOf(judgeTextOf({ kind: '스트라이크', isSwinging: false }, true, true), 0)).toEqual([])
    // 맞힌 공 · 볼 따위에 남은 앞 공의 값은 글자를 안 바꾼다
    expect(judgeTextOf({ kind: '볼' }, true, true)).toBe('볼넷')
    expect(judgeTextOf({ kind: '스트라이크', isSwinging: true }, false, true)).toBe('헛스윙')
  })
})
