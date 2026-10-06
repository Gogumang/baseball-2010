import { afterEach, describe, expect, it } from 'vitest'
import { BATTERS, PITCHERS } from '@/shared/config/original/roster'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import {
  EDITED_BATTER_SLOTS, EDITED_PITCHER_SLOTS, EMPTY_EDITED_NAMES, clearEditedNames, clipEditedName,
  editedNameOf, normalizeEditedNames, withEditedName,
} from '@/entities/player-name/model/editedNames'
import { originalNameOf, playerNameOf, setActiveEditedNames } from '@/entities/player-name/model/playerName'

afterEach(() => setActiveEditedNames(EMPTY_EDITED_NAMES))

describe('에디트 이름표 (save[+0xac]+0x178, 0xaa458·0xaa4ad)', () => {
  it('투수 80 · 타자 120 칸 — 빈 칸은 고친 이름이 없다', () => {
    expect(EMPTY_EDITED_NAMES.pitchers).toHaveLength(EDITED_PITCHER_SLOTS)
    expect(EMPTY_EDITED_NAMES.batters).toHaveLength(EDITED_BATTER_SLOTS)
    expect(editedNameOf(EMPTY_EDITED_NAMES, 0, true)).toBeNull()
  })

  it('id 로 칸이 걸리고 투수·타자 칸은 따로다', () => {
    const table = withEditedName(EMPTY_EDITED_NAMES, 3, true, '홍길동')
    expect(editedNameOf(table, 3, true)).toBe('홍길동')
    expect(editedNameOf(table, 3, false)).toBeNull()
  })

  it('범위 밖 id(투수 > 0x4f · 타자 > 0x77)는 칸이 없다 — 0xaa458 이 NULL', () => {
    expect(editedNameOf(withEditedName(EMPTY_EDITED_NAMES, 0x50, true, '가'), 0x50, true)).toBeNull()
    expect(editedNameOf(withEditedName(EMPTY_EDITED_NAMES, 0x77, false, '가'), 0x77, false)).toBe('가')
    expect(editedNameOf(withEditedName(EMPTY_EDITED_NAMES, 0x78, false, '가'), 0x78, false)).toBeNull()
  })

  it('글은 CP949 8 바이트까지 — 한글 4 · 영문 8 · 섞어 쓰기', () => {
    expect(clipEditedName('가나다라마')).toBe('가나다라')
    expect(clipEditedName('ABCDEFGHIJ')).toBe('ABCDEFGH')
    expect(clipEditedName('가나ABCDE')).toBe('가나ABCD')
  })

  it('에디트 초기화(0x204c1)는 표를 통째로 비운다', () => {
    expect(clearEditedNames()).toEqual(EMPTY_EDITED_NAMES)
  })

  it('옛 저장(칸 없음)·이상한 값은 빈 표로 읽는다', () => {
    expect(normalizeEditedNames(null)).toEqual(EMPTY_EDITED_NAMES)
    const table = normalizeEditedNames({ pitchers: ['김', 3], batters: 'x' })
    expect(table.pitchers[0]).toBe('김')
    expect(table.pitchers[1]).toBe('')
    expect(table.batters).toHaveLength(EDITED_BATTER_SLOTS)
  })
})

describe('선수 이름 0xb62c0 — 고친 이름 있으면 그것, 없으면 원래 이름', () => {
  it('공용 함수가 이름표를 먼저 본다', () => {
    setActiveEditedNames(withEditedName(EMPTY_EDITED_NAMES, 5, false, '새이름'))
    expect(playerNameOf(5, false, '옛이름')).toBe('새이름')
    expect(playerNameOf(5, true, '옛이름')).toBe('옛이름')
  })

  it('붙박이 선수표의 name 도 같은 길을 탄다 — 경기·기록 화면이 읽는 그 값', () => {
    const pitcher = teamPitchers(2)[1]
    const batter = teamBatters(9)[11]
    const pitcherOriginal = pitcher.name
    const batterOriginal = batter.name
    setActiveEditedNames(
      withEditedName(withEditedName(EMPTY_EDITED_NAMES, pitcher.id, true, '투수새'), batter.id, false, '타자새'),
    )
    expect(PITCHERS[pitcher.id].name).toBe('투수새')
    expect(teamBatters(9)[11].name).toBe('타자새')
    expect(originalNameOf(pitcher)).toBe(pitcherOriginal)
    // 같은 레코드 객체 그대로 — indexOf 쓰임이 안 깨진다
    expect(PITCHERS.indexOf(pitcher)).toBe(pitcher.id)
    setActiveEditedNames(EMPTY_EDITED_NAMES)
    expect(pitcher.name).toBe(pitcherOriginal)
    expect(batter.name).toBe(batterOriginal)
  })

  it('국가대표 팀(10~14) 선수는 이름표 칸이 없어 원래 이름이다', () => {
    const national = PITCHERS[0x50]
    const original = national.name
    setActiveEditedNames(withEditedName(EMPTY_EDITED_NAMES, 0x50, true, '가'))
    expect(national.name).toBe(original)
    expect(BATTERS[0x78].name).toBe(originalNameOf(BATTERS[0x78]))
  })

  it('복사(펼치기·JSON)에도 고친 이름이 실린다', () => {
    setActiveEditedNames(withEditedName(EMPTY_EDITED_NAMES, 0, true, '복사'))
    expect({ ...PITCHERS[0] }.name).toBe('복사')
    expect(JSON.parse(JSON.stringify(PITCHERS[0])).name).toBe('복사')
  })
})
