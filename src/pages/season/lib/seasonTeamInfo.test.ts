import { describe, expect, it } from 'vitest'
import { seasonTeamInfoRowsOf, stadiumLineOf, teamTypeFrameOf } from '@/pages/season/lib/seasonTeamInfo'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import { coachNameOf } from '@/entities/season-mode/model/seasonCoach'

const 레코드 = startNewSeason(0, '단장님').record

describe('구단정보 0xd5 정보 칸 (0x7c450 시즌 갈래)', () => {
  it('이름표는 표 0xd48a8 차례 — 단장·코치·좌석·구장·타입·우승·순위', () => {
    const rows = seasonTeamInfoRowsOf({ record: 레코드, teamAbilities: [365, 440, 430, 365], rank: 3 })
    expect(rows.map((row) => row.labelFrame)).toEqual([394, 222, 191, 80, 321, 224, 47])
    expect(rows[0].value).toEqual({ kind: '글', text: '단장님' })
  })

  it('코치는 SR+0x185 ≥ 0 이면 그 마선수 이름, 아니면 "----"', () => {
    expect(seasonTeamInfoRowsOf({ record: { ...레코드, coach: -1 }, teamAbilities: [], rank: 0 })[1].value)
      .toEqual({ kind: '글', text: '----' })
    expect(seasonTeamInfoRowsOf({ record: { ...레코드, coach: 6 }, teamAbilities: [], rank: 0 })[1].value)
      .toEqual({ kind: '글', text: coachNameOf(6) })
  })

  it('좌석 = 0xd44f4[관중석] × 1000 + "석" · 구장 = 세 이름을 " / " 로', () => {
    const record = { ...레코드, stadiumEquipped: [2, 0, 0] }
    const rows = seasonTeamInfoRowsOf({ record, teamAbilities: [], rank: 0 })
    expect(rows[2].value).toEqual({ kind: '숫자', value: 30000, suffixFrame: 345 })
    expect(rows[3].value).toEqual({ kind: '흐르는글', text: stadiumLineOf([2, 0, 0]) })
    expect(stadiumLineOf([2, 0, 0]).split(' / ')).toHaveLength(3)
  })

  it('우승 0 · 경기 수 0 이면 "--", 아니면 우승 횟수 · 순위 + 1', () => {
    const none = seasonTeamInfoRowsOf({ record: { ...레코드, regularSeasonFirsts: 0, games: 0 }, teamAbilities: [], rank: 4 })
    expect(none[5].value).toEqual({ kind: '글', text: '--' })
    expect(none[6].value).toEqual({ kind: '글', text: '--' })
    const some = seasonTeamInfoRowsOf({ record: { ...레코드, regularSeasonFirsts: 3, games: 12 }, teamAbilities: [], rank: 4 })
    expect(some[5].value).toEqual({ kind: '숫자', value: 3 })
    expect(some[6].value).toEqual({ kind: '숫자', value: 5 })
  })

  it('타입 = 팀 레코드 네 값 중 가장 큰 칸의 이름표 (같으면 앞 칸)', () => {
    expect(teamTypeFrameOf([365, 440, 430, 365])).toBe(347) // 타격
    expect(teamTypeFrameOf([500, 500, 100, 100])).toBe(263) // 같으면 투구
    expect(teamTypeFrameOf([1, 2, 3, 9])).toBe(205) // 근성
    expect(teamTypeFrameOf([1, 2, 9, 9])).toBe(204) // 집중 (앞 칸)
  })
})
