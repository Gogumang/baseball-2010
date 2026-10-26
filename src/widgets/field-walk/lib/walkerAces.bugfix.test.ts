import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { walkAceSpritesOf } from '@/widgets/field-walk/lib/walkerAces'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

/** 포수(니블 2 → 칸 1) 마타자 4 · 유격(니블 6 → 칸 5) 마타자 1 — 레코드 차례로 첫 마타자는 4 */
const records: { position: number; ace: number | null }[] = [2, 3, 4, 5, 6, 7, 8, 9, 1].map((position) => ({ position, ace: null }))
records[0] = { position: 2, ace: 4 }
records[4] = { position: 6, ace: 1 }

describe('B-83 교대 판 · 벤치 클리어링의 타자 마선수 그림도 팀당 첫 한 명으로 뭉개진다 (0x3fac4 3ff62~3ff8a · 0x3a5f0 3a6f4~3a716)', () => {
  it('원본: 칸 5 도 첫 마타자(4) 그림', () => {
    const sprites = walkAceSpritesOf({ pitcherAce: null, records })
    expect(sprites[1]).toEqual({ kind: 'batter', index: 4 })
    expect(sprites[5]).toEqual({ kind: 'batter', index: 4 })
  })

  it('고침: 칸마다 제 그림 — 칸 0 투수 마선수(a 갈래)는 그대로 먼저', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-83']))
    expect(walkAceSpritesOf({ pitcherAce: null, records })[5]).toEqual({ kind: 'batter', index: 1 })
    expect(walkAceSpritesOf({ pitcherAce: null, records })[1]).toEqual({ kind: 'batter', index: 4 })
    expect(walkAceSpritesOf({ pitcherAce: 2, records })[0]).toEqual({ kind: 'pitcher', index: 2 })
  })
})
