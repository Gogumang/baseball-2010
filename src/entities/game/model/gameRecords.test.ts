import { describe, expect, it } from 'vitest'
import { atBatRecordIdsOf, gameEndRecordIdsOf, recordGamePointsOf, RECORD_NAMES, completeGameRecordIdsOf, strikeoutRecordIdsOf, threePitchInningRecordIdsOf } from '@/entities/game/model/gameRecords'
import type { CompleteGameInput, StrikeoutRecordInput } from '@/entities/game/model/gameRecords'

const 타석 = (overrides = {}) => ({
  outcome: { kind: '아웃', detail: '땅볼아웃' } as const,
  runsScored: 0,
  consecutiveHits: 0,
  homeRunsInGame: 0,
  walksInGame: 0,
  completesCycle: false,
  ...overrides,
})

describe('기록달성 — 0xa77f0 · 금액표 0xd8158', () => {
  it('이름은 StrGAME[id+8]', () => {
    expect([RECORD_NAMES[0], RECORD_NAMES[15], RECORD_NAMES[39]]).toEqual(['3루타', '사이클링 히트', '30점차 이상 승'])
  })

  it('3루타 · 홈런은 그 플레이 득점 수 1~4 로 솔로~만루 (0xa8024)', () => {
    expect(atBatRecordIdsOf(타석({ outcome: { kind: '안타', bases: 3 } }))).toEqual([0])
    expect(atBatRecordIdsOf(타석({ outcome: { kind: '홈런' }, runsScored: 4, homeRunsInGame: 1 }))).toEqual([4])
  })

  it('연타석 히트 3·4·5 · 한 타자 2·3·4홈런 · 사이클링 · 2·3볼넷', () => {
    expect(atBatRecordIdsOf(타석({ outcome: { kind: '홈런' }, runsScored: 1, consecutiveHits: 3, homeRunsInGame: 2 }))).toEqual([1, 9, 12])
    expect(atBatRecordIdsOf(타석({ outcome: { kind: '안타', bases: 2 }, consecutiveHits: 5, completesCycle: true }))).toEqual([11, 15])
    expect(atBatRecordIdsOf(타석({ outcome: { kind: '볼넷' }, walksInGame: 3 }))).toEqual([35])
  })

  it('경기 끝 — 10·20·30점차 이상 승 (가장 큰 것 하나, 추정)', () => {
    expect([9, 10, 25, 31].map((margin) => gameEndRecordIdsOf(margin))).toEqual([[], [37], [38], [39]])
  })

  it('지급액 = Σ 금액 (0x4ea0c)', () => {
    expect(recordGamePointsOf([0, 4, 15, 37])).toBe(10 + 15 + 100 + 10)
  })
})

describe('완투 계열 기록 — 0xa7de8 (승리·모드·코스확정·아웃수 네 조건을 먼저 본다)', () => {
  // 모드 0(일반)에 사람이 코스를 찍고 이긴 경기 = 완투 계열이 나올 수 있는 최소 조건
  const 완투 = (overrides: Partial<CompleteGameInput> = {}): CompleteGameInput => ({
    mode: 0,
    won: true,
    pitchCourseConfirmed: true,
    inningsPlayed: 9,
    outsRecorded: 27,
    hitsAllowed: 5,
    walksAllowed: 2,
    runsAllowed: 3,
    ...overrides,
  })

  it('진 경기에는 주지 않는다 — 0xa7de8 이 사람 팀 승리를 먼저 본다', () => {
    expect(completeGameRecordIdsOf(완투({ won: false }))).toEqual([])
  })

  it('나만의리그 타자편(모드 4)에서는 한 번도 나오지 않는다', () => {
    expect(completeGameRecordIdsOf(완투({ mode: 4 }))).toEqual([])
  })

  it('사람이 투구 코스를 한 번도 확정하지 않았으면 주지 않는다 — state+0x8c', () => {
    expect(completeGameRecordIdsOf(완투({ pitchCourseConfirmed: false }))).toEqual([])
  })

  it('치른 이닝을 다 채우지 못하면 아무것도 주지 않는다 — 중간에 내려가면 완투가 아니다', () => {
    expect(completeGameRecordIdsOf(완투({ outsRecorded: 26 }))).toEqual([])
  })

  it('연장이면 그만큼 아웃을 더 잡아야 한다 — 정규 9이닝이 아니라 치른 이닝 전부', () => {
    expect(completeGameRecordIdsOf(완투({ inningsPlayed: 11, outsRecorded: 27 }))).toEqual([])
    expect(completeGameRecordIdsOf(완투({ inningsPlayed: 11, outsRecorded: 33 }))).toEqual([28])
  })

  it('실점이 있으면 완투승(28)', () => {
    expect(completeGameRecordIdsOf(완투())).toEqual([28])
  })

  it('실점 0 이면 완봉승(29)', () => {
    expect(completeGameRecordIdsOf(완투({ runsAllowed: 0 }))).toEqual([29])
  })

  it('피안타·실점 0 이면 노히트노런(30) — 볼넷은 있어도 된다', () => {
    expect(completeGameRecordIdsOf(완투({ hitsAllowed: 0, runsAllowed: 0 }))).toEqual([30])
  })

  it('출루·피안타·실점이 모두 0 이면 퍼펙트게임(31)', () => {
    expect(completeGameRecordIdsOf(완투({ hitsAllowed: 0, walksAllowed: 0, runsAllowed: 0 }))).toEqual([31])
  })

  it('연장에 가면 퍼펙트게임이 아니다 — 아웃 28 부터는 노히트노런으로 내려간다', () => {
    const 연장 = 완투({ inningsPlayed: 10, outsRecorded: 30, hitsAllowed: 0, walksAllowed: 0, runsAllowed: 0 })

    expect(completeGameRecordIdsOf(연장)).toEqual([30])
  })

  it('금액은 노히트노런 100 · 퍼펙트게임 120 이다', () => {
    expect(recordGamePointsOf([30])).toBe(100)
    expect(recordGamePointsOf([31])).toBe(120)
  })
})

describe('삼진 계열 기록 — 16~23·25 (0xa7c4c·0xa7d0c)', () => {
  const 삼진 = (overrides: Partial<StrikeoutRecordInput> = {}): StrikeoutRecordInput => ({
    pitches: 5,
    balls: 1,
    comboCount: 1,
    pitcherStrikeouts: 1,
    ...overrides,
  })

  it('공 셋으로 끝내면 삼구 삼진(16)', () => {
    expect(strikeoutRecordIdsOf(삼진({ pitches: 3 }))).toContain(16)
    expect(strikeoutRecordIdsOf(삼진({ pitches: 4 }))).not.toContain(16)
  })

  it('볼 셋까지 가서 잡으면 풀카운트 삼진(17)', () => {
    expect(strikeoutRecordIdsOf(삼진({ balls: 3 }))).toContain(17)
    expect(strikeoutRecordIdsOf(삼진({ balls: 2 }))).not.toContain(17)
  })

  it('연속 삼진 3·6·9 에서 콤보 기록(18·19·20)', () => {
    expect(strikeoutRecordIdsOf(삼진({ comboCount: 3 }))).toContain(18)
    expect(strikeoutRecordIdsOf(삼진({ comboCount: 6 }))).toContain(19)
    expect(strikeoutRecordIdsOf(삼진({ comboCount: 9 }))).toContain(20)
    // 사이 숫자에는 주지 않는다 — 딱 그 순간 한 번씩이다
    expect(strikeoutRecordIdsOf(삼진({ comboCount: 4 })).filter((id) => id >= 18 && id <= 20)).toEqual([])
  })

  it('한 투수 10·15·20삼진에서 기록(21·22·23)', () => {
    expect(strikeoutRecordIdsOf(삼진({ pitcherStrikeouts: 10 }))).toContain(21)
    expect(strikeoutRecordIdsOf(삼진({ pitcherStrikeouts: 15 }))).toContain(22)
    expect(strikeoutRecordIdsOf(삼진({ pitcherStrikeouts: 20 }))).toContain(23)
  })

  it('한 타석에서 여러 기록이 겹칠 수 있다', () => {
    const ids = strikeoutRecordIdsOf({ pitches: 3, balls: 3, comboCount: 3, pitcherStrikeouts: 10 })

    expect(ids).toEqual([16, 17, 18, 21])
  })

  it('한 이닝을 공 셋으로 끝내면 삼구 삼자범퇴(25)', () => {
    expect(threePitchInningRecordIdsOf(3, 3)).toEqual([25])
    expect(threePitchInningRecordIdsOf(4, 3)).toEqual([])
    // 3아웃으로 끝나지 않았으면 주지 않는다
    expect(threePitchInningRecordIdsOf(3, 2)).toEqual([])
  })
})
