import { describe, expect, it } from 'vitest'
import { LOGO_VOICE_UPDATE, logoDoneUpdateOf, logoPoseAt } from '@/pages/title/model/logoIntro'

describe('켤 때 로고 (하위 2, 객체 갱신 0x69400 · 그리기 0x68c18)', () => {
  it('갱신 #0 은 상태 0(그림 올리기) — 흰 바탕뿐', () => {
    expect(logoPoseAt(0)).toEqual({ kind: '흰바탕' })
    expect(logoPoseAt(1)).toEqual({ kind: '흰바탕' })
  })

  it('상태 1 은 갱신마다 [+0x97] 이 3 씩 — +2 뒤 값이 118 + 10 을 넘는 갱신 #44 까지 칠한다', () => {
    expect(logoPoseAt(2)).toEqual({ kind: '칠하기', revealed: 3 })
    expect(logoPoseAt(45)).toEqual({ kind: '칠하기', revealed: 132 })
    expect(logoPoseAt(46)).toEqual({ kind: '겹치기', frame: 1, weight: 14 })
  })

  it('상태 2 는 [+0xa4] 15 → 0 으로 프레임 1 을 빼고, 0 이 되는 갱신에 음성 0 · 상태 3 은 프레임 2 를 1 → 15', () => {
    expect(LOGO_VOICE_UPDATE).toBe(59)
    expect(logoPoseAt(60)).toEqual({ kind: '겹치기', frame: 1, weight: 0 })
    expect(logoPoseAt(61)).toEqual({ kind: '겹치기', frame: 2, weight: 1 })
    expect(logoPoseAt(75)).toEqual({ kind: '겹치기', frame: 2, weight: 15 })
    expect(logoPoseAt(76)).toEqual({ kind: '로고', frame: 2 })
  })

  it('상태 4 는 1000ms 를 넘긴 갱신에 → 5, 그다음 갱신에 인증을 지나 답 1', () => {
    // 62ms 면 17 갱신째(1054ms)에 넘는다 — #74 + 17 = #91 → 5, #92 답 1
    expect(logoDoneUpdateOf(62)).toBe(92)
    // 250ms 면 4 × 250 = 1000 은 안 넘는다(bhi) — 5 갱신째
    expect(logoDoneUpdateOf(250)).toBe(80)
  })
})
