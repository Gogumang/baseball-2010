import { afterEach, describe, expect, it } from 'vitest'
import { resetLiveGameState, setLiveGameInningIndex, setLiveGameSides } from '@/shared/lib/liveGameState/liveGameState'
import { seasonCardAbilitiesOf, seasonCardInfoOf, seasonPlayerDetailViewOf } from '@/pages/season/lib/seasonPlayerDetail'
import type { SeasonPlayerDetailContext } from '@/pages/season/lib/seasonPlayerDetail'
import type { SeasonPlayerRecordView } from '@/entities/season-mode/model/seasonPlayerRecord'
import { seasonPlayerRecordOf } from '@/entities/season-mode/model/seasonPlayerRecord'
import { seasonRecordProfileOf, tableRosterOf } from '@/entities/season-mode/model/seasonEntry'
import { nariRecruitPlayerOf } from '@/entities/season-mode/model/playerRecruit'

/**
 * 시즌 능력치 상세 창 글 0x897e8 — 표 다섯 줄과 글 줄 (차례·문구·조건은 0x897e8~0x8a00c 를 직접 떴다).
 */

const 타자 = (patch: Partial<SeasonPlayerRecordView> = {}): SeasonPlayerRecordView => ({
  name: '시험타자', isPitcher: false, base: [500, 500, 500, 500], profile: 0, skillBits: 0,
  equipment: [0, 0, 0, 0], fieldPosition: 3, isComplete: true, ...patch,
})
const 투수 = (patch: Partial<SeasonPlayerRecordView> = {}) => 타자({ name: '시험투수', isPitcher: true, fieldPosition: 0, ...patch })

const 건강 = (patch: Partial<SeasonPlayerDetailContext['record']> = {}, teamMorale = 100): SeasonPlayerDetailContext => ({
  record: { illness: 0, illnessSlack: 0, coach: -1, teamId: 0, ...patch }, teamMorale,
})

describe('표 다섯 줄 (0x872a0)', () => {
  it('현재 = 0xb6415(k, 0) · 최대 = 0x5e864 · 변화 = 0xb570c − 현재 · 사기 줄 = 팀 사기 / 100 / 0', () => {
    const { rows } = seasonPlayerDetailViewOf(타자({ profile: 0x20, equipment: [1, 0, 0, 0] }), 건강())
    expect(rows.map((row) => [row.current, row.maximum, row.change, row.bonus])).toEqual([
      [500, 800, 30, 0], // 장비 니블 1 → +30
      [500, 850, 0, 0],
      [500, 750, 0, 0],
      [500, 750, 0, 0],
      [100, 100, 0, 0],
    ])
  })

  it('이름표 — 0x87320~0x8734a: 시즌(창+0x20 == 2) · [창+0x174] == 0xda 에서 투수면 340~343, 타자면 336~339', () => {
    expect(seasonPlayerDetailViewOf(투수(), 건강()).rows.map((row) => row.labelFrame)).toEqual([340, 341, 342, 343, 84])
    expect(seasonPlayerDetailViewOf(타자(), 건강()).rows.map((row) => row.labelFrame)).toEqual([336, 337, 338, 339, 84])
  })

  it('변화 칸은 팀 능력치 보정이 빠진(0xb570c 마지막 인자 0) 시즌 내 팀 값 — 사기 정액 · 코치', () => {
    const { rows } = seasonPlayerDetailViewOf(타자(), 건강({ coach: 5 }, 40))
    // 사기 40 → −50, 코치 5(타자 히트 +8)
    expect(rows.slice(0, 4).map((row) => row.change)).toEqual([-42, -50, -50, -50])
  })
})

describe('글 줄 차례 (0x897e8)', () => {
  it('장비 줄 — "[!cFFFF00" + StrITEM[(n−1) + 11k (+44 투수)] + "!cFFFFFF] " + StrMODE[35+k|40+k] + " +" + 0xd41ae[n−1]', () => {
    expect(seasonPlayerDetailViewOf(타자({ equipment: [2, 5, 0, 0] }), 건강()).messages).toEqual([
      '[!cFFFF00라이트 헬멧!cFFFFFF] 히트 +50',
      '[!cFFFF00스피릿 배트!cFFFFFF] 파워 +110',
    ])
    expect(seasonPlayerDetailViewOf(투수({ equipment: [3, 0, 0, 0] }), 건강()).messages).toEqual([
      '[!cFFFF00스킬풀 모자!cFFFFFF] 제구 +70',
    ])
  })

  it('스킬 5 · 7 → 질병(SR+5) → 사기 ≤ 50 → 포지션 → 코치', () => {
    const view = 타자({ skillBits: (1 << 5) | (1 << 7), profile: 1, fieldPosition: 3 })
    expect(seasonPlayerDetailViewOf(view, 건강({ illness: 2, coach: 9 }, 50)).messages).toEqual([
      '[!cFFFF00무력감!cFFFFFF] 모든능력치 -100',
      '[!cFFFF00전설!cFFFFFF] 모든능력치 +50',
      '[!cFFFF00질병!cFFFFFF] 모든능력치 30% 감소',
      '[!cFFFF00사기!cFFFFFF] 모든능력치 50 감소',
      '[!cFFFF00포지션!cFFFFFF]불일치: 수비 20% 감소',
      '[!cFFFF00코치!cFFFFFF] !cFFFF00팀 타자 히트/파워 +7',
    ])
  })

  it('사기 줄 숫자는 정액 — >30 50 · >10 100 · 그 밖 200, 51 이상이면 줄이 없다', () => {
    const 사기줄 = (morale: number) => seasonPlayerDetailViewOf(타자(), 건강({}, morale)).messages
    expect(사기줄(51)).toEqual([])
    expect(사기줄(31)).toEqual(['[!cFFFF00사기!cFFFFFF] 모든능력치 50 감소'])
    expect(사기줄(30)).toEqual(['[!cFFFF00사기!cFFFFFF] 모든능력치 100 감소'])
    expect(사기줄(10)).toEqual(['[!cFFFF00사기!cFFFFFF] 모든능력치 200 감소'])
  })

  it('⚠️ 질병 줄은 SR+5 를 보고 −30% 는 SR+6 을 본다 — 입원 여유가 0 이면 줄만 있고 변화가 없다', () => {
    const view = seasonPlayerDetailViewOf(타자(), 건강({ illness: 1, illnessSlack: 0 }))
    expect(view.messages).toEqual(['[!cFFFF00질병!cFFFFFF] 모든능력치 30% 감소'])
    expect(view.rows[0]?.change).toBe(0)
    expect(seasonPlayerDetailViewOf(타자(), 건강({ illness: 1, illnessSlack: 3 })).rows[0]?.change).toBe(-150)
  })

  it('포지션 줄은 타자만 — 지명(1)·후보(0)·10 · 내야 보직 2~6 · 외야 보직 7~9 · 스킬 21 이면 없다', () => {
    const 줄 = (patch: Partial<SeasonPlayerRecordView>) => seasonPlayerDetailViewOf(타자(patch), 건강()).messages
    expect(줄({ profile: 0, fieldPosition: 6 })).toEqual([])
    expect(줄({ profile: 1, fieldPosition: 9 })).toEqual([])
    expect(줄({ profile: 1, fieldPosition: 1 })).toEqual([])
    expect(줄({ profile: 0, fieldPosition: 7, skillBits: 1 << 21 })).toEqual([])
    expect(줄({ profile: 2, fieldPosition: 3 })).toEqual(['[!cFFFF00포지션!cFFFFFF]불일치: 수비 20% 감소'])
    expect(seasonPlayerDetailViewOf(투수({ profile: 0, fieldPosition: 7 }), 건강()).messages).toEqual([])
  })

  it('코치 줄은 0~4 면 투수만 · 5~9 면 타자만 — StrMODE[149 + 코치]', () => {
    expect(seasonPlayerDetailViewOf(투수(), 건강({ coach: 0 })).messages).toEqual(['[!cFFFF00코치!cFFFFFF] !cFFFF00팀 투수 변화 +8'])
    expect(seasonPlayerDetailViewOf(타자(), 건강({ coach: 0 })).messages).toEqual([])
    expect(seasonPlayerDetailViewOf(투수(), 건강({ coach: 5 })).messages).toEqual([])
  })
})

describe('카드 도형 0x7ba44 시즌 갈래', () => {
  it('값은 실효값, 견줄 기본값은 0xb6415(k, 0)', () => {
    expect(seasonCardAbilitiesOf(타자({ equipment: [0, 1, 0, 0] }), 건강({}, 20))).toEqual([
      { base: 500, shown: 400 },
      { base: 500, shown: 430 },
      { base: 500, shown: 400 },
      { base: 500, shown: 400 },
    ])
  })
})

describe('정보 칸 0x7c450 시즌 · 0xd9 갈래 — seasonCardInfoOf', () => {
  it('타자: 타입 +0xb>>5 · 보직 +0xb&3 · 손 (+0xb>>4)&1 · 피부 (+0xb&0xc)/4 · 타순 (+0xa&0x1f)+1, 필살은 표 +0x18 = 0 이라 빈칸', () => {
    const view = { ...seasonPlayerRecordOf(0, tableRosterOf(0).batters[0]!, false, 0), profile: 17 }
    expect(seasonCardInfoOf(view, '서울 드래곤즈', 3)).toEqual({
      values: ['서울 드래곤즈', view.name, '타격형', '', '외야', '좌타', '황인'],
      battingOrder: 4,
    })
  })

  it('투수: 타입·손은 +2 칸, 보직은 min(r, 1) + 2 · 타순 없음', () => {
    const view = { ...seasonPlayerRecordOf(0, tableRosterOf(0).pitchers[0]!, true, 0), profile: 0b0010_0110 }
    expect(seasonCardInfoOf(view, 'T', 0)).toEqual({
      values: ['T', view.name, '사이드암', '', '구원', '우완', '백인'],
      battingOrder: null,
    })
  })

  it('투수 타입 2 는 표 0x1400258 다섯째 칸 언더스로다', () => {
    const view = { ...seasonPlayerRecordOf(0, tableRosterOf(0).pitchers[0]!, true, 0), profile: 0b0100_0000 }
    expect(seasonCardInfoOf(view, 'T', 0).values[2]).toBe('언더스로')
  })

  it('영입한 나리 타자 — 기록 사본의 +0xb · +0x18 을 읽는다 (장타형 · 좌타 · 흑인 · 외야, 필살 4 + 타입 = 메테오 스윙)', () => {
    const player = nariRecruitPlayerOf({
      name: '나리', ability: [600, 600, 600, 600], profile: seasonRecordProfileOf(1, 1, 2, 1), specialNumber: 4,
    }, false)
    const view = seasonPlayerRecordOf(0, player, false, 0)
    expect(seasonCardInfoOf(view, 'T', player.kindByte).values).toEqual(['T', '나리', '장타형', '메테오 스윙', '외야', '좌타', '흑인'])
  })

  it('영입한 투수 — +0x18 은 고른 마구, 옛 사본(+0xb 칸 없음)은 보직만', () => {
    const player = nariRecruitPlayerOf({
      name: '철완', ability: [1, 1, 1, 1], repertoire: { name: '철완', form: 0, magicId: 2, pitchMask: 1 }, role: 2,
    }, true)
    const view = seasonPlayerRecordOf(0, player, true, 0)
    expect(seasonCardInfoOf(view, 'T', player.kindByte).values).toEqual(['T', '철완', '오버핸드', '웨이브 볼', '구원', '우완', '황인'])
  })
})

describe('스킬 14 투지 갈래 0xb5a16~0xb5a72 (A-11) — 마지막 사람 경기의 전역 상태를 본다', () => {
  afterEach(() => {
    resetLiveGameState()
    setLiveGameSides({ ourTeamId: 0, opponentTeamId: 0, ourScore: 0, opponentScore: 0, playerSide: 0 })
  })
  /** 장착 비트 14 */
  const 투지투수 = 투수({ skillBits: 1 << 14 })

  it('6회 이후(+0x6b > 4)이고 내 팀이 지는 측이면 제구·구속·변화 += v/10, 체력(칸 3)은 빠진다', () => {
    setLiveGameInningIndex(5)
    setLiveGameSides({ ourTeamId: 0, opponentTeamId: 3, ourScore: 1, opponentScore: 4, playerSide: 1 })
    expect(seasonPlayerDetailViewOf(투지투수, 건강()).rows.map((row) => row.change)).toEqual([50, 50, 50, 0, 0])
    expect(seasonCardAbilitiesOf(투지투수, 건강()).map((ability) => ability.shown)).toEqual([550, 550, 550, 500])
  })

  it('5회(+0x6b = 4) · 이기는 측 · 장착 안 함 · 타자면 없다', () => {
    setLiveGameSides({ ourTeamId: 0, opponentTeamId: 3, ourScore: 1, opponentScore: 4, playerSide: 0 })
    setLiveGameInningIndex(4)
    expect(seasonPlayerDetailViewOf(투지투수, 건강()).rows[0]?.change).toBe(0)
    setLiveGameInningIndex(8)
    expect(seasonPlayerDetailViewOf(투지투수, 건강()).rows[0]?.change).toBe(50)
    expect(seasonPlayerDetailViewOf(투수(), 건강()).rows[0]?.change).toBe(0)
    expect(seasonPlayerDetailViewOf(타자({ skillBits: 1 << 14 }), 건강()).rows[0]?.change).toBe(0)
    setLiveGameSides({ ourTeamId: 0, opponentTeamId: 3, ourScore: 5, opponentScore: 4, playerSide: 0 })
    expect(seasonPlayerDetailViewOf(투지투수, 건강()).rows[0]?.change).toBe(0)
  })

  it('동점이면 측 0(0xb6a4c 가 0) · 두 측 어디에도 없는 팀은 측 1(0xb6be8) 로 본다', () => {
    setLiveGameInningIndex(8)
    setLiveGameSides({ ourTeamId: 0, opponentTeamId: 3, ourScore: 2, opponentScore: 2, playerSide: 0 })
    expect(seasonPlayerDetailViewOf(투지투수, 건강()).rows[0]?.change).toBe(50)
    setLiveGameSides({ ourTeamId: 0, opponentTeamId: 3, ourScore: 2, opponentScore: 2, playerSide: 1 })
    expect(seasonPlayerDetailViewOf(투지투수, 건강()).rows[0]?.change).toBe(0)
    // 다른 팀끼리의 경기(측 0 = 5)가 남았고 측 1 이 지면 — 내 팀(0)은 측 1 로 보아 붙는다
    setLiveGameSides({ ourTeamId: 5, opponentTeamId: 6, ourScore: 3, opponentScore: 1, playerSide: 0 })
    expect(seasonPlayerDetailViewOf(투지투수, 건강()).rows[0]?.change).toBe(50)
  })

  it('0xb6814(경기 준비)가 이닝 · 점수를 지우면 없다', () => {
    setLiveGameInningIndex(8)
    setLiveGameSides({ ourTeamId: 0, opponentTeamId: 3, ourScore: 0, opponentScore: 2, playerSide: 0 })
    resetLiveGameState()
    expect(seasonPlayerDetailViewOf(투지투수, 건강()).rows[0]?.change).toBe(0)
  })

  it('팀 정액 뒤 · 코치 앞 — 투수 코치 +값은 10% 에 안 들어간다', () => {
    setLiveGameInningIndex(8)
    setLiveGameSides({ ourTeamId: 0, opponentTeamId: 3, ourScore: 0, opponentScore: 2, playerSide: 0 })
    const 코치 = seasonPlayerDetailViewOf(투지투수, 건강({ coach: 4 })).rows.map((row) => row.change)
    const 코치없음 = seasonPlayerDetailViewOf(투지투수, 건강()).rows.map((row) => row.change)
    expect(코치[0]! - 코치없음[0]!).toBe(코치[3]!)
  })
})
