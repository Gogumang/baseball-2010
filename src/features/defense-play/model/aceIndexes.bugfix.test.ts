import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { aceIndexesWithOriginalBug } from '@/features/defense-play/model/defensePlayView'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

/** 칸 0 투수 마선수 1 · 칸 3 메디카(0) · 칸 7 로제(2) */
const 표 = [1, null, null, 0, null, null, null, 2, null]

describe('B-83 홈런 재생의 타자 마선수 그림이 팀당 첫 한 명으로 뭉개진다', () => {
  it('원본: 칸 7 도 첫 타자 마선수(0) 그림 — 칸 0 투수는 그대로', () => {
    expect(aceIndexesWithOriginalBug(표)).toEqual([1, null, null, 0, null, null, null, 0, null])
  })

  it('고침: 칸마다 제 그림', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-83']))
    expect(aceIndexesWithOriginalBug(표)).toEqual(표)
  })
})
