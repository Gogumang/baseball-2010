import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { MY_RECORD_SLOT, insertMyBatter, moveMyBatter, myBatterIndexOf, tableNariTeamRecord } from '@/entities/career/model/nariTeamRecord'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 팀 = 3
const 칸들 = (record: { readonly batters: readonly { readonly slot: number }[] }) => record.batters.map((row) => row.slot)
/** 내 선수를 8번(칸 7)에 — 원래 8번(마스터 7)은 맨 끝 칸 12 로 */
const 등록 = () => insertMyBatter(tableNariTeamRecord(팀), 7)

describe('B-71 타순 보상 19 — 셋이 돌다 망가지는 갈래', () => {
  it('원본: 같은 칸이면 내 선수가 벤치로 · 원래 주인이 선 칸으로 가면 내 선수가 사라진다', () => {
    expect(myBatterIndexOf(moveMyBatter(등록(), 7))).toBe(12)
    expect(myBatterIndexOf(moveMyBatter(등록(), 12))).toBe(-1)
  })

  it('고침: 같은 칸은 그대로 · 원래 주인이 선 칸이면 둘만 맞바꾼다 — 보통 갈래(셋이 돎)는 원본과 같다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-71']))
    expect(moveMyBatter(등록(), 7)).toEqual(등록())
    const swapped = moveMyBatter(등록(), 12)
    expect(myBatterIndexOf(swapped)).toBe(12)
    expect(swapped.batters[7].slot).toBe(7)
    expect(칸들(moveMyBatter(등록(), 8))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, MY_RECORD_SLOT, 9, 10, 11, 8])
  })
})
