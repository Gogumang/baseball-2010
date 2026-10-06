import { describe, expect, it } from 'vitest'
import { seasonHallOfFameRecordSourceOf } from '@/app/model/seasonHallOfFameRecords'
import type { HallOfFamePitcher } from '@/entities/collection/model/collection'
import type { SeasonPlayer } from '@/entities/season-mode/model/playerRecruit'

const 투수: HallOfFamePitcher = {
  name: '김구원', ability: { control: 1, velocity: 2, breaking: 3, stamina: 4 },
  equippedAbility: { control: 1, velocity: 2, breaking: 3, stamina: 4 }, endingIndex: 5, season: 10, titleIds: [], slot: 0,
  look: { typeIndex: 0, handIndex: 0, skinIndex: 0, teamId: 1 },
}
const 영입투수: SeasonPlayer = { id: 0xb4, kindByte: 0, fieldPosition: 0, stamina: 10000 }

describe('영입 명전 투수의 보직 +0xb & 3 (0xb6dec)', () => {
  it('명전 기록의 보직을 경기 기록 행에 싣는다', () => {
    const source = seasonHallOfFameRecordSourceOf({ hallOfFame: [], hallOfFamePitchers: [{ ...투수, role: 2 }] })
    expect(source.pitcher(영입투수)?.role).toBe(2)
  })

  it('옛 명전 기록(보직 칸 없음)은 싣지 않는다 — 받는 쪽이 선발로 본다', () => {
    const source = seasonHallOfFameRecordSourceOf({ hallOfFame: [], hallOfFamePitchers: [투수] })
    expect(source.pitcher(영입투수)).toBeDefined()
    expect(source.pitcher(영입투수)).not.toHaveProperty('role')
  })
})
