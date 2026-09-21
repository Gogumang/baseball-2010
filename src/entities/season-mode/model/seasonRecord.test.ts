import { describe, expect, it } from 'vitest'
import { TEAMS } from '@/shared/config/original/teams'
import {
  GAME_RECORD_SIZE,
  MORALE_LIMIT,
  SEASON_GAME_COUNT,
  STADIUM_EQUIPPED_SIZE,
  STADIUM_OWNED_SIZE,
  TEAM_ABILITY_LIMIT,
  clampTo,
  initialTeamAbilities,
  isFinalYear,
  normalizeSeasonRecord,
  normalizeSeasonState,
  seasonDayOf,
  startNewSeason,
  startNextYear,
} from '@/entities/season-mode/model/seasonRecord'

describe('새 시즌 0x5758', () => {
  it('소지금 50(=5000만) · 인기도 0 · 팀 사기 100 으로 시작한다', () => {
    const { record, teamMorale } = startNewSeason(3, '테스트구단')
    expect(record.teamId).toBe(3)
    expect(record.money).toBe(50)
    expect(record.popularity).toBe(0)
    expect(teamMorale).toBe(MORALE_LIMIT)
  })

  it('평판·연차는 0 으로 남는다 (0x5758 이 쓰지 않는다)', () => {
    const { record } = startNewSeason(0, 'T')
    expect(record.reputation).toBe(0)
    expect(record.yearIndex).toBe(0)
  })

  it('평판 기록은 16칸, 구장 보유 플래그는 21칸이다', () => {
    const { record } = startNewSeason(0, 'T')
    expect(record.gameRecord).toHaveLength(GAME_RECORD_SIZE)
    expect(record.stadiumOwned).toHaveLength(STADIUM_OWNED_SIZE)
    expect(record.stadiumEquipped).toEqual([0, 0, 0])
  })

  it('팀 능력치는 XlsTEAM_DATA 값 그대로다', () => {
    const abilities = initialTeamAbilities()
    expect(abilities).toHaveLength(10)
    expect(abilities[0]).toEqual(TEAMS[0].values.slice(2))
  })
})

describe('새 해 0x6e0c', () => {
  it('연차가 오르고 사기가 100 으로 돌아가며 경기 수가 0 이 된다', () => {
    const 앞 = startNewSeason(0, 'T')
    const 뒤 = startNextYear({ ...앞, teamMorale: 12, record: { ...앞.record, games: 45, yearIndex: 2 } })
    expect(뒤.record.yearIndex).toBe(3)
    expect(뒤.record.games).toBe(0)
    expect(뒤.teamMorale).toBe(MORALE_LIMIT)
  })

  it('CPU 9팀만 능력치가 +30 오른다 — 내 팀은 그대로다', () => {
    const 앞 = startNewSeason(4, 'T')
    const 뒤 = startNextYear(앞)
    expect(뒤.teamAbilities[4]).toEqual(앞.teamAbilities[4])
    expect(뒤.teamAbilities[0]).toEqual(앞.teamAbilities[0].map((value) => value + 30))
  })

  it('팀 능력치는 999 에서 막힌다', () => {
    const 앞 = startNewSeason(0, 'T')
    const 가득 = { ...앞, teamAbilities: 앞.teamAbilities.map(() => [990, 999, 700, 500]) }
    const 뒤 = startNextYear(가득)
    expect(뒤.teamAbilities[1]).toEqual([TEAM_ABILITY_LIMIT, TEAM_ABILITY_LIMIT, 730, 530])
  })

  it('인기도·평판·소지금은 해를 넘겨 그대로 간다', () => {
    const 앞 = startNewSeason(0, 'T')
    const 뒤 = startNextYear({
      ...앞,
      record: { ...앞.record, popularity: 700, reputation: 300, money: 1_234 },
    })
    expect(뒤.record.popularity).toBe(700)
    expect(뒤.record.reputation).toBe(300)
    expect(뒤.record.money).toBe(1_234)
    // 목표 ⑤ 가 보는 "시즌 시작 인기도" 는 새로 떠 둔다
    expect(뒤.record.popularityAtSeasonStart).toBe(700)
  })

  it('⚠️ 국가대항전 플래그를 내리지 않는다 (원본 그대로 — 사용자 판단 대기)', () => {
    const 앞 = startNewSeason(0, 'T')
    const 뒤 = startNextYear({ ...앞, record: { ...앞.record, nationalCup: true } })
    expect(뒤.record.nationalCup).toBe(true)
  })
})

describe('이벤트 날짜와 연차', () => {
  it('지금 = 연차idx × 45 + 경기수 + 1', () => {
    const { record } = startNewSeason(0, 'T')
    expect(seasonDayOf(record)).toBe(1)
    expect(seasonDayOf({ ...record, games: 2 })).toBe(3)
    expect(seasonDayOf({ ...record, games: 20 })).toBe(21)
    expect(seasonDayOf({ ...record, yearIndex: 1, games: 0 })).toBe(SEASON_GAME_COUNT + 1)
  })

  it('10년차(연차 idx 9)가 엔딩이 걸리는 해다', () => {
    const { record } = startNewSeason(0, 'T')
    expect(isFinalYear(record)).toBe(false)
    expect(isFinalYear({ ...record, yearIndex: 9 })).toBe(true)
  })
})

describe('clampTo — 원본의 0..상한 자르기', () => {
  it('위아래를 모두 자른다', () => {
    expect(clampTo(-5, 100)).toBe(0)
    expect(clampTo(150, 100)).toBe(100)
    expect(clampTo(50, 100)).toBe(50)
  })
})

describe('서브 아이템 칸 (R12 (나) · P4 3절 정정)', () => {
  it('트레이닝 4칸(0x58~0x5b)과 외출 5칸(0x5d~0x61)은 서로 다른 줄이다', () => {
    const { record } = startNewSeason(0, '팀')

    expect(record.trainingSubItems).toHaveLength(4)
    expect(record.outingSubItems).toHaveLength(5)
    // 자동안마기(0x5c)는 둘 사이의 별도 칸이라 어느 배열에도 안 들어간다
    expect(record.massager).toBe(false)
  })
})

describe('옛 세이브 메우기 — normalizeSeasonRecord', () => {
  it('배열 칸이 통째로 없는 세이브도 기본값으로 채운다 (예전에는 경기 한 판에 터졌다)', () => {
    // 필드가 늘기 전에 저장한 세이브 — 배열 칸이 아예 없다
    const 옛세이브 = { teamId: 3, name: '드래곤즈', money: 120, games: 12, yearIndex: 1 }
    const 메운것 = normalizeSeasonRecord(옛세이브)

    expect(메운것.gameRecord).toHaveLength(GAME_RECORD_SIZE)
    expect(메운것.gameRecord.every((칸) => 칸 === 0)).toBe(true)
    expect(메운것.stadiumEquipped).toHaveLength(STADIUM_EQUIPPED_SIZE)
    expect(메운것.stadiumOwned).toHaveLength(STADIUM_OWNED_SIZE)
    expect(메운것.trainingSubItems).toHaveLength(4)
    expect(메운것.outingSubItems).toHaveLength(5)
  })

  it('저장된 값은 손대지 않는다', () => {
    const 옛세이브 = { teamId: 3, name: '드래곤즈', money: 120, games: 12, yearIndex: 1 }
    const 메운것 = normalizeSeasonRecord(옛세이브)
    expect(메운것.teamId).toBe(3)
    expect(메운것.name).toBe('드래곤즈')
    expect(메운것.money).toBe(120)
    expect(메운것.games).toBe(12)
    expect(메운것.yearIndex).toBe(1)
  })

  it('길이가 모자란 배열은 뒤를 채워 늘린다 (칸이 늘어난 경우)', () => {
    const 메운것 = normalizeSeasonRecord({ gameRecord: [5, 7], stadiumEquipped: [2] })
    expect(메운것.gameRecord).toHaveLength(GAME_RECORD_SIZE)
    expect(메운것.gameRecord[0]).toBe(5)
    expect(메운것.gameRecord[1]).toBe(7)
    expect(메운것.gameRecord[2]).toBe(0)
    expect(메운것.stadiumEquipped).toEqual([2, 0, 0])
  })

  it('null 이면 새 시즌 기본값이다', () => {
    expect(normalizeSeasonRecord(null).gameRecord).toHaveLength(GAME_RECORD_SIZE)
  })

  it('코치 칸(SR+0x185)이 없던 세이브는 **없음(−1)** 으로 채운다', () => {
    const 메운것 = normalizeSeasonRecord({ teamId: 3, money: 120 })
    expect(메운것.coach).toBe(-1)
    // 저장된 코치는 그대로 둔다
    expect(normalizeSeasonRecord({ coach: 7 }).coach).toBe(7)
  })
})

describe('옛 세이브 메우기 — normalizeSeasonState', () => {
  it('사기·팀 능력치가 없으면 새 시즌 값으로 채운다', () => {
    const 메운것 = normalizeSeasonState({ record: { teamId: 2 } })
    expect(메운것.teamMorale).toBe(MORALE_LIMIT)
    expect(메운것.teamAbilities).toHaveLength(10)
    expect(메운것.record.teamId).toBe(2)
  })

  it('있는 사기·능력치는 그대로 둔다', () => {
    const 메운것 = normalizeSeasonState({ teamMorale: 42, teamAbilities: [[1, 2, 3, 4]] })
    expect(메운것.teamMorale).toBe(42)
    expect(메운것.teamAbilities[0]).toEqual([1, 2, 3, 4])
  })
})
