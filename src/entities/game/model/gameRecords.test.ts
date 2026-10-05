import { describe, expect, it } from 'vitest'
import { atBatRecordIdsOf, gameEndRecordIdsOf, recordGamePointsOf, RECORD_NAMES, completeGameRecordIdsOf, strikeoutRecordIdsOf, threePitchInningRecordIdsOf, pinchHitHomeRunRecordIdsOf, backToBackRecordOf, stealPlayRecordIdsOf, multiOutPlayRecordIdsOf, foulRecordOf, laserThrowOutRecordOf, passesRecordTeamGate } from '@/entities/game/model/gameRecords'
import type { CompleteGameInput, StrikeoutRecordInput, StealPlayRunner } from '@/entities/game/model/gameRecords'

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

describe('남은 아홉 가지 — 판정 함수 (R8 5절·4-4)', () => {
  it('5 대타 홈런 — 대타 타석의 홈런만 (0xa8024 @a8764)', () => {
    expect(pinchHitHomeRunRecordIdsOf({ isHomeRun: true, isPinchHitAtBat: true })).toEqual([5])
    expect(pinchHitHomeRunRecordIdsOf({ isHomeRun: true, isPinchHitAtBat: false })).toEqual([])
    expect(pinchHitHomeRunRecordIdsOf({ isHomeRun: false, isPinchHitAtBat: true })).toEqual([])
  })

  it('6·7 백투백 — 2 에서 6, 3 에서 7 을 주고 0 으로, 다섯 번째에 다시 6 (0xa794c)', () => {
    let streak = 0
    const ids: number[][] = []
    for (let i = 0; i < 5; i += 1) {
      const step = backToBackRecordOf({ streak, humanOffense: true, isHomeRun: true })
      streak = step.streak
      ids.push(step.recordIds)
    }
    expect(ids).toEqual([[], [6], [7], [], [6]])
  })

  it('백투백 카운터 — 홈런 아닌 타석·상대 팀 홈런은 0 으로', () => {
    expect(backToBackRecordOf({ streak: 1, humanOffense: true, isHomeRun: false })).toEqual({ streak: 0, recordIds: [] })
    expect(backToBackRecordOf({ streak: 1, humanOffense: false, isHomeRun: true })).toEqual({ streak: 0, recordIds: [] })
  })

  const 주자 = (overrides: Partial<StealPlayRunner> = {}): StealPlayRunner => ({
    stealStarted: true,
    fromBase: 1,
    currentBase: 2,
    targetBase: 2,
    finished: true,
    safe: true,
    ...overrides,
  })

  it('8 도루 성공 — 루를 옮긴 도루 주자마다 하나 (0xa8024 @a83c6)', () => {
    expect(stealPlayRecordIdsOf({ isRunnerPlay: true, runners: [주자(), 주자({ fromBase: 2, currentBase: 3, targetBase: 3 })] })).toEqual([8, 8])
    expect(stealPlayRecordIdsOf({ isRunnerPlay: true, runners: [주자({ stealStarted: false })] })).toEqual([])
  })

  it('24 도루 저지 — 하나라도 잡히면 한 번만 주고 8 은 없다 (@a83de)', () => {
    const 잡힘 = 주자({ currentBase: 1, safe: false })
    expect(stealPlayRecordIdsOf({ isRunnerPlay: true, runners: [잡힘, 주자({ fromBase: 2, currentBase: 3, targetBase: 3 })] })).toEqual([24])
    expect(stealPlayRecordIdsOf({ isRunnerPlay: true, runners: [잡힘, { ...잡힘, fromBase: 2, targetBase: 3 }] })).toEqual([24])
  })

  it('주자 플레이(종류 5)가 아닌 정산에서는 둘 다 없다', () => {
    expect(stealPlayRecordIdsOf({ isRunnerPlay: false, runners: [주자()] })).toEqual([])
  })

  it('26·27 병살·삼중살 — 공 하나 플레이의 아웃 2·3, 주자 달리는 중 삼진이면 26 없음 (@a8e70·a8e84)', () => {
    expect([1, 2, 3].map((outsInPlay) => multiOutPlayRecordIdsOf({ outsInPlay, strikeoutWhileRunning: false }))).toEqual([[], [26], [27]])
    expect(multiOutPlayRecordIdsOf({ outsInPlay: 2, strikeoutWhileRunning: true })).toEqual([])
    expect(multiOutPlayRecordIdsOf({ outsInPlay: 3, strikeoutWhileRunning: true })).toEqual([27])
  })

  it('32·33 연속 파울 — 세 번째 32, 네 번째 33, 그 뒤는 없음 (0xa7dbc)', () => {
    let foulStreak = 0
    const ids: number[][] = []
    for (let i = 0; i < 6; i += 1) {
      const step = foulRecordOf(foulStreak)
      foulStreak = step.foulStreak
      ids.push(step.recordIds)
    }
    expect(ids).toEqual([[], [], [32], [33], [], []])
  })

  it('36 필살송구 — 아웃이 있을 때만 주고 지운다, 아웃이 없으면 플래그가 남는다 (@a810c)', () => {
    expect(laserThrowOutRecordOf({ laserThrowFlag: true, outsInPlay: 1 })).toEqual({ laserThrowFlag: false, recordIds: [36] })
    expect(laserThrowOutRecordOf({ laserThrowFlag: true, outsInPlay: 0 })).toEqual({ laserThrowFlag: true, recordIds: [] })
    expect(laserThrowOutRecordOf({ laserThrowFlag: false, outsInPlay: 2 })).toEqual({ laserThrowFlag: false, recordIds: [] })
  })

  it('금액표 — 5·6·7·8·24·26·27·32·33·36', () => {
    expect([5, 6, 7, 8, 24, 26, 27, 32, 33, 36].map((id) => recordGamePointsOf([id]))).toEqual([10, 20, 40, 2, 3, 2, 100, 3, 5, 3])
  })
})

describe('지급 게이트 0xa77f0 의 팀 방향 (R8 1절)', () => {
  const 공격 = { offenseIsHuman: true, defenseIsHuman: false }
  const 수비 = { offenseIsHuman: false, defenseIsHuman: true }

  it('사람 공격이면 0~15·32~35 만, 36 과 수비 계열은 버린다', () => {
    expect([0, 5, 6, 7, 8, 15, 32, 33, 35].every((id) => passesRecordTeamGate(id, 공격))).toBe(true)
    expect([16, 24, 26, 27, 36].some((id) => passesRecordTeamGate(id, 공격))).toBe(false)
  })

  it('사람 수비면 16~31·36 만', () => {
    expect([16, 24, 26, 27, 36].every((id) => passesRecordTeamGate(id, 수비))).toBe(true)
    expect([0, 8, 32].some((id) => passesRecordTeamGate(id, 수비))).toBe(false)
  })

  it('공격이 사람이면 수비도 사람이어도 수비 계열은 버린다 (elif)', () => {
    expect(passesRecordTeamGate(24, { offenseIsHuman: true, defenseIsHuman: true })).toBe(false)
  })

  it('28~31·37~39 는 게이트를 건너뛴다 — 둘 다 CPU 여도 통과', () => {
    const 없음 = { offenseIsHuman: false, defenseIsHuman: false }
    expect([28, 29, 30, 31, 37, 38, 39].every((id) => passesRecordTeamGate(id, 없음))).toBe(true)
    expect([0, 16, 36].some((id) => passesRecordTeamGate(id, 없음))).toBe(false)
  })
})
