import { describe, expect, it } from 'vitest'
import { seasonHallOfFameRecordSourceOf } from '@/app/model/seasonHallOfFameRecords'
import type { HallOfFamePitcher } from '@/entities/collection/model/collection'
import type { SeasonPlayer } from '@/entities/season-mode/model/playerRecruit'
import { seasonDetailSourceOf } from '@/entities/season-mode/model/seasonEntry'
import { nariRecordSalaryGradeOf } from '@/entities/career/model/seasonFlow'

const 투수: HallOfFamePitcher = {
  name: '김구원',
  ability: { control: 1, velocity: 2, breaking: 3, stamina: 4 },
  equippedAbility: { control: 1, velocity: 2, breaking: 3, stamina: 4 },
  endingIndex: 5,
  season: 10,
  titleIds: [],
  slot: 0,
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

describe('영입 선수 레코드 +0x1b — 나리 연봉 쓰기 0xa4fd8 의 min(연봉 / 10, 255)', () => {
  it('명전 기록의 칸을 싣고 상세 창 연봉(× 1000)이 읽는다 · 옛 기록은 비운다', () => {
    const source = seasonHallOfFameRecordSourceOf({ hallOfFame: [], hallOfFamePitchers: [{ ...투수, salaryGrade: 12 }] })
    const record = source.pitcher(영입투수)
    expect(record?.salaryGrade).toBe(12)
    const 사본: SeasonPlayer = { ...영입투수, id: 0xfe, record: record! }
    expect(seasonDetailSourceOf(0, 사본, true, [1, 2, 3, 4])?.grade).toBe(12)
    const 옛: SeasonPlayer = { ...사본, record: seasonHallOfFameRecordSourceOf({ hallOfFame: [], hallOfFamePitchers: [투수] }).pitcher(영입투수)! }
    expect(seasonDetailSourceOf(0, 옛, true, [1, 2, 3, 4])?.grade).toBeNull()
  })

  it('등록 0x10fb4 의 연봉 50 은 5 · 0xff 에서 막힌다', () => {
    expect(nariRecordSalaryGradeOf(50)).toBe(5)
    expect(nariRecordSalaryGradeOf(59)).toBe(5)
    expect(nariRecordSalaryGradeOf(2559)).toBe(255)
    expect(nariRecordSalaryGradeOf(9999)).toBe(255)
  })
})
