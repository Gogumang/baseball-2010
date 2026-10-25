import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_UNLOCK_CONFIG, UNLOCK_CONFIG, hiddenUnlockIdOf, setUnlockConfigForTests } from '@/shared/config/unlocks'
import { createCareer } from '@/entities/career/model/playerCareer'
import { equipmentBlockReasonOf, isHiddenOpen } from '@/entities/career/model/equipment'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { isPitcherHiddenOpen } from '@/entities/pitcher-career/model/pitcherEquipment'
import { isHiddenPitchRowOpen } from '@/entities/pitcher-career/model/pitchTraining'
import {
  EMPTY_COLLECTION, HALL_OF_FAME_MAX_BATTERS, HALL_OF_FAME_MAX_PITCHERS, isHallOfFameSlotOpen,
} from '@/entities/collection/model/collection'
import { hiddenNameOf } from '@/entities/collection/model/hiddenOpenNotice'
import { BATTER_MISSIONS, PITCHER_MISSIONS } from '@/entities/mission/model/missionGoal'
import { checkSeasonEquipment } from '@/entities/season-mode/model/seasonEquipment'
import { checkStadiumPurchase } from '@/entities/season-mode/model/stadiumItems'
import { normalizeSeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { isLockedStadiumSlot } from '@/pages/season/lib/stadiumItemWindow'
import { equipmentItemNameOf, LOCKED_ITEM_NAME } from '@/pages/season/lib/seasonEquipmentWindow'
import { hiddenTeamHintOf } from '@/pages/season/ui/SeasonTeamSelectScreen'
import { isTeamOpen } from '@/pages/create-player/lib/teamSelectLayout'
import { isTeamOpened } from '@/pages/general-mode/lib/hiddenTeam'
import { quickStartTeamCandidates } from '@/pages/general-mode/lib/quickStart'
import {
  INITIAL_ACE_OPEN_SAVE, aceBatterIdsOf, aceOpenAnswerOf, acePitcherIdsOf, isAceCellOpen, isAceCellUnlocked,
} from '@/pages/general-mode'

/**
 * 해금 표(`unlocks.json`)가 각 잠금 판정 자리에 닿는가 — 표를 켜면 풀리고, 원본 표(시험 기본)면 원본 판정 그대로다.
 * 저장 값(커리어 · 마선수 칸 · 기록연감)은 어느 쪽에서도 바뀌지 않는다.
 */
afterEach(() => setUnlockConfigForTests(ORIGINAL_UNLOCK_CONFIG))
const withUnlockAll = () => setUnlockConfigForTests(UNLOCK_CONFIG)

describe('표 이름이 원본 이름과 같다', () => {
  it('전역 해금 k 0~50 — 0x61e8c 이름', () => {
    for (let k = 0; k <= 50; k += 1) {
      const entry = UNLOCK_CONFIG.entries.find((candidate) => candidate.id === hiddenUnlockIdOf(k))
      expect(entry?.name, `k ${k}`).toBe(hiddenNameOf(k)?.trim())
    }
  })

  it('미션 칸 수가 편마다 14 다 (칸 0 은 처음부터 열림 → 표 13칸)', () => {
    expect(BATTER_MISSIONS).toHaveLength(14)
    expect(PITCHER_MISSIONS).toHaveLength(14)
  })
})

describe('히든 장비', () => {
  it('타자 장비 레벨 7~10 — 원본은 미오픈, 표를 켜면 열린다. 커리어 해금표는 그대로', () => {
    const career = createCareer('나리')
    expect(isHiddenOpen(career, 1, 9)).toBe(false)
    expect(equipmentBlockReasonOf(career, 1, 9)).toBe('미오픈')
    withUnlockAll()
    expect(isHiddenOpen(career, 1, 9)).toBe(true)
    expect(equipmentBlockReasonOf(career, 1, 9)).not.toBe('미오픈')
    expect(career.openedHiddenIds).toEqual([])
  })

  it('투수 장비', () => {
    const career = createPitcherCareer('나리')
    expect(isPitcherHiddenOpen(career, 0, 7)).toBe(false)
    withUnlockAll()
    expect(isPitcherHiddenOpen(career, 0, 7)).toBe(true)
  })

  it('시즌모드 장비 · 구장 히든 칸', () => {
    const record = normalizeSeasonRecord(null)
    const target = { isBatter: true, equipment: [0, 0, 0, 0] }
    const closed = () => false
    expect(checkSeasonEquipment(record, target, 0, 8, closed)).toEqual({ ok: false, reason: '미오픈' })
    expect(equipmentItemNameOf(true, 0, 8, closed)).toBe(LOCKED_ITEM_NAME)
    expect(isLockedStadiumSlot('관중석', 4, closed)).toBe(true)
    expect(checkStadiumPurchase(record, 0, '관중석', 4, closed)).toEqual({ ok: false, reason: '미오픈' })
    withUnlockAll()
    expect(checkSeasonEquipment(record, target, 0, 8, closed)).not.toEqual({ ok: false, reason: '미오픈' })
    expect(equipmentItemNameOf(true, 0, 8, closed)).not.toBe(LOCKED_ITEM_NAME)
    expect(isLockedStadiumSlot('관중석', 4, closed)).toBe(false)
    expect(checkStadiumPurchase(record, 0, '관중석', 4, closed)).not.toEqual({ ok: false, reason: '미오픈' })
  })
})

describe('마선수 · 히든 팀', () => {
  it('마선수 열 칸 — 표를 켜면 드래고나까지 다 열리고 오픈 팝업 대신 레벨업 쪽이다. 저장 칸은 그대로', () => {
    const save = INITIAL_ACE_OPEN_SAVE
    expect(acePitcherIdsOf(save)).toEqual([0])
    expect(aceOpenAnswerOf(save, 4, 0)).toBe('못여는칸')
    withUnlockAll()
    expect(acePitcherIdsOf(save)).toEqual([0, 1, 2, 3, 4])
    expect(aceBatterIdsOf(save)).toEqual([0, 1, 2, 3, 4])
    expect(isAceCellUnlocked(save, 4)).toBe(true)
    expect(aceOpenAnswerOf(save, 4, 0)).toBe('이미열림')
    // 기록 쪽(새로 열렸나 · 외인구단 0x7b408)은 저장 값을 본다
    expect(isAceCellOpen(save, 4)).toBe(false)
    expect(save.cells.filter(Boolean)).toHaveLength(2)
  })

  it('히든 팀 10~14 — 팀 고르기 · 일반모드 · 시즌 힌트 · 빠른 실행 후보', () => {
    expect(isTeamOpen(12, [])).toBe(false)
    expect(isTeamOpened(12, [])).toBe(false)
    expect(hiddenTeamHintOf(12, [])).toContain('선택 할 수 없는 팀입니다')
    expect(quickStartTeamCandidates([])).toHaveLength(10)
    withUnlockAll()
    expect(isTeamOpen(12, [])).toBe(true)
    expect(isTeamOpened(14, [])).toBe(true)
    expect(hiddenTeamHintOf(12, [])).not.toContain('선택 할 수 없는 팀입니다')
    expect(quickStartTeamCandidates([])).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
  })

  it('빠른 실행 후보 — 원본 0x9f5a0 은 저장+0x7a..0x7e(팀 10~14) 다섯 칸만 본다. 전역 표의 다른 번호(33 장비 등)는 안 섞인다', () => {
    expect(quickStartTeamCandidates([12, 10, 33])).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12])
    expect(quickStartTeamCandidates([0, 7, 13, 15, 33, 50])).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 13])
    withUnlockAll()
    expect(quickStartTeamCandidates([33, 50])).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
  })
})

describe('마구 · 명예의 전당', () => {
  it('마구 계열 — 이벤트가 여는 저장 칸은 그대로', () => {
    const career = createPitcherCareer('나리')
    expect(isHiddenPitchRowOpen(career, 0)).toBe(false)
    withUnlockAll()
    expect(isHiddenPitchRowOpen(career, 0)).toBe(true)
    expect(career.hiddenPitchRows).toEqual([false, false, false, false])
  })

  it('명전 칸 — 원본 기본 개방 투수 2 · 타자 4, 표를 켜면 전부', () => {
    const openCount = (side: '투수' | '타자', max: number) =>
      Array.from({ length: max }, (_unused, slot) => isHallOfFameSlotOpen(side, slot)).filter(Boolean).length
    expect(openCount('투수', HALL_OF_FAME_MAX_PITCHERS)).toBe(2)
    expect(openCount('타자', HALL_OF_FAME_MAX_BATTERS)).toBe(4)
    withUnlockAll()
    expect(openCount('투수', HALL_OF_FAME_MAX_PITCHERS)).toBe(4)
    expect(openCount('타자', HALL_OF_FAME_MAX_BATTERS)).toBe(8)
    expect(EMPTY_COLLECTION.hallOfFame).toEqual([])
  })
})
