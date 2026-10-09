import { describe, expect, it } from 'vitest'
import { loadedRunnerAceOf, runnerAceIndexesOf } from '@/features/defense-play/model/runnerAces'

const 만루 = { first: true, second: true, third: true }
const 일삼루 = { first: true, second: false, third: true }

describe('주자 마선수 그림 (0x43aa8 · 0x483a0)', () => {
  it('진행기 주자 칸(0 타자주자 → 찬 루 오름차순)마다 마선수 번호를 단다', () => {
    expect(runnerAceIndexesOf({ batter: null, first: 2, third: 0 }, 일삼루)).toEqual([null, 2, 0])
    expect(runnerAceIndexesOf(undefined, 만루)).toEqual([null, null, null, null])
  })

  it('타자가 마선수면 그 그림을 싣는다', () => {
    expect(loadedRunnerAceOf({ batter: 4, first: 1 }, 만루)).toBe(4)
  })

  it('아니면 목록 끝까지 덮어써서 가장 앞선 마선수 주자의 그림이 남는다', () => {
    expect(loadedRunnerAceOf({ first: 1, third: 3 }, 일삼루)).toBe(3)
    expect(loadedRunnerAceOf({ first: 1 }, 일삼루)).toBe(1)
    expect(loadedRunnerAceOf({}, 만루)).toBeNull()
  })

  it('빈 루의 값은 안 본다 · 0~4 밖은 마선수가 아니다', () => {
    expect(loadedRunnerAceOf({ second: 2 }, 일삼루)).toBeNull()
    expect(runnerAceIndexesOf({ batter: 7 }, 일삼루)).toEqual([null, null, null])
  })
})
