import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { batterEquipmentRowsOf, pitcherEquipmentRowsOf } from '@/pages/shop/lib/equipmentRows'
import {
  EQUIPMENT_VISIBLE_ROWS, LOCKED_NAME,
} from '@/pages/shop/lib/equipmentWindowLayout'
import {
  INITIAL_EQUIPMENT_WINDOW, equipmentKeyOf, equipmentWindowKeyOf, previewLevelOf,
} from '@/pages/shop/lib/equipmentWindowState'

describe('장비 줄 (0x8146c · 0x83378)', () => {
  it('상점은 열한 레벨 전부 — 잠긴 히든은 "????", 보너스는 표 0xd41ae', () => {
    const rows = batterEquipmentRowsOf(createCareer('타자'), 0, false)
    expect(rows).toHaveLength(11)
    expect(rows[0]).toMatchObject({ id: '장착:0:0', name: '나이스 헬멧', bonus: 30, price: 5000 })
    expect(rows[7].name).toBe(LOCKED_NAME)
    expect(rows[10].bonus).toBe(250)
  })

  it('설명 — 레벨 ≤ 6 은 인기도 줄(StrITEM 184/185), 잠긴 히든은 힌트, 열린 히든은 비운다', () => {
    const career = createCareer('타자')
    const rows = batterEquipmentRowsOf(career, 0, false)
    expect(rows[0].description).toBe('인기도 제한 없음')
    expect(rows[1].description).toBe('인기도 50 이상')
    expect(rows[7].description).toBe('고기를 많이 먹자')

    const opened = batterEquipmentRowsOf({ ...career, openedHiddenIds: [35] }, 0, false)
    expect(opened[7].name).not.toBe(LOCKED_NAME)
    expect(opened[7].description).toBe('')
  })

  it('장비착용은 가진 레벨만 차례로', () => {
    const career = { ...createCareer('타자'), ownedEquipment: ['1-2', '1-0'], equipmentLevels: { ...createCareer('타자').equipmentLevels, power: 3 } }
    const rows = batterEquipmentRowsOf(career, 1, true)
    expect(rows.map((row) => row.level)).toEqual([0, 2])
    expect(rows[1]).toMatchObject({ id: '착용:1:2', isEquipped: true, isOwned: true })
  })

  it('투수 줄은 투수 이름·가격·힌트 표', () => {
    const rows = pitcherEquipmentRowsOf(createPitcherCareer('투수'), 0, false)
    expect(rows[0]).toMatchObject({ name: '나이스 모자', price: 4000 })
    expect(rows[7].description).toBe('착, 착각하지마!')
  })
})

describe('장비 창 키 (0x819ad 종류 3)', () => {
  it('탭 초점에서 ←→ 는 부위를 감고 줄을 처음으로', () => {
    const left = equipmentWindowKeyOf(INITIAL_EQUIPMENT_WINDOW, '왼', 11)
    expect(left).toEqual({ kind: '상태', state: { focus: '탭', part: 3, cursor: 0, top: 0 } })
  })

  it('탭 초점의 확인 · 아래는 줄이 있을 때만 목록으로, 취소는 나가기', () => {
    expect(equipmentWindowKeyOf(INITIAL_EQUIPMENT_WINDOW, '확인', 11)).toMatchObject({ state: { focus: '줄' } })
    expect(equipmentWindowKeyOf(INITIAL_EQUIPMENT_WINDOW, '아래', 0)).toMatchObject({ state: { focus: '탭' } })
    expect(equipmentWindowKeyOf(INITIAL_EQUIPMENT_WINDOW, '취소', 11)).toEqual({ kind: '나가기' })
  })

  it('줄 초점 — 위·아래는 감고, 화면 밖이면 윗줄을 옮긴다 · 취소는 탭으로 · 확인은 고르기', () => {
    const list = { ...INITIAL_EQUIPMENT_WINDOW, focus: '줄' as const }
    const up = equipmentWindowKeyOf(list, '위', 11)
    expect(up).toEqual({ kind: '상태', state: { ...list, cursor: 10, top: 10 - EQUIPMENT_VISIBLE_ROWS + 1 } })
    expect(equipmentWindowKeyOf({ ...list, cursor: 10, top: 6 }, '아래', 11)).toEqual({ kind: '상태', state: { ...list, cursor: 0, top: 0 } })
    expect(equipmentWindowKeyOf({ ...list, cursor: 4 }, '취소', 11)).toEqual({ kind: '상태', state: INITIAL_EQUIPMENT_WINDOW })
    expect(equipmentWindowKeyOf({ ...list, cursor: 4 }, '확인', 11)).toEqual({ kind: '고르기', cursor: 4 })
  })

  it('웹 키 → 원본 키 (숫자 2·4·5·6·8 포함)', () => {
    expect(equipmentKeyOf('8')).toBe('아래')
    expect(equipmentKeyOf('5')).toBe('확인')
    expect(equipmentKeyOf('Escape')).toBe('취소')
    expect(equipmentKeyOf('x')).toBeNull()
  })

  it('입혀 보기는 줄 초점의 커서 줄만', () => {
    expect(previewLevelOf(INITIAL_EQUIPMENT_WINDOW, [0, 2])).toBeNull()
    expect(previewLevelOf({ ...INITIAL_EQUIPMENT_WINDOW, focus: '줄', cursor: 1 }, [0, 2])).toBe(2)
  })
})
