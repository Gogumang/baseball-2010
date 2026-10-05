import { describe, expect, it } from 'vitest'
import { screenBgmOf } from '@/app/model/screenBgm'

describe('포스트시즌 대진 128 배경음 — 진입 0x120a4 (이전 상태 1 일 때만 4)', () => {
  it('이어하기(100 → 1 → 128)면 배경음 4', () => {
    expect(screenBgmOf({ kind: '포스트시즌', popup: null, fromReentry: true })).toBe(4)
    // 팝업이 떠도 같은 배경음 — 진입에서만 정한다
    expect(screenBgmOf({ kind: '포스트시즌', popup: { kind: '정규시즌우승' }, fromReentry: true })).toBe(4)
  })

  it('131 뒤·경기 뒤는 114 이벤트 재생을 지나와 그 배경음 40 이 이어진다', () => {
    expect(screenBgmOf({ kind: '포스트시즌', popup: null })).toBe(40)
    expect(screenBgmOf({ kind: '포스트시즌', popup: null, fromReentry: false })).toBe(40)
  })
})
