import { describe, expect, it } from 'vitest'
import {
  ACE_DEFAULT_OPEN_CELLS,
  ACE_GAMEPOINT_LOCKED_CELLS,
} from '@/shared/config/original/aceOpen'
import {
  ACE_OPEN_CELL_COUNT,
  aceBatterIdsOf,
  aceOpenAnswerOf,
  aceOpenPriceOf,
  acePitcherIdsOf,
  isAceCellOpen,
  normalizeAceOpenSave,
  openAceCell,
} from '@/pages/general-mode/lib/aceOpenState'

/** 마선수 오픈 플래그 저장 칸 — 원본 전역 기록 `mgr[0x30..0x39]` (0xa3f6) */

describe('저장 칸 정규화', () => {
  it('열 칸이다 — mgr[0x30]~mgr[0x39]', () => {
    expect(normalizeAceOpenSave(null).cells).toHaveLength(ACE_OPEN_CELL_COUNT)
    expect(ACE_OPEN_CELL_COUNT).toBe(10)
  })

  it('저장이 없던 옛 세이브는 기본 개방 둘(칸 0 싸이커 · 5 메디카)만 켜진다', () => {
    const save = normalizeAceOpenSave(null)

    expect(save.cells.map((open, cell) => (open ? cell : null)).filter((cell) => cell !== null))
      .toEqual([...ACE_DEFAULT_OPEN_CELLS])
  })

  it('칸이 모자란 옛 저장은 빠진 칸을 거짓으로 채운다 — 읽은 칸은 그대로 산다', () => {
    const save = normalizeAceOpenSave({ cells: [true, true, true] })

    expect(save.cells).toHaveLength(ACE_OPEN_CELL_COUNT)
    expect(save.cells[1]).toBe(true)
    expect(save.cells[9]).toBe(false)
  })

  it('형식이 틀린 값은 통째로 무시하고 기본 개방만 남긴다', () => {
    expect(normalizeAceOpenSave({ cells: '열개' }).cells[1]).toBe(false)
    expect(normalizeAceOpenSave(42).cells[0]).toBe(true)
  })

  it('기본 개방 둘은 저장이 거짓이어도 켠다 — 원본은 해금 id 가 없는 칸이다', () => {
    const save = normalizeAceOpenSave({ cells: Array.from({ length: 10 }, () => false) })

    expect(save.cells[0]).toBe(true)
    expect(save.cells[5]).toBe(true)
  })
})

describe('열린 칸 → 화면이 받는 로컬 번호', () => {
  it('윗줄 0~4 가 마투수, 아랫줄 5~9 가 마타자다', () => {
    const save = normalizeAceOpenSave({ cells: [true, false, true, false, false, true, false, false, false, true] })

    expect(acePitcherIdsOf(save)).toEqual([0, 2])
    expect(aceBatterIdsOf(save)).toEqual([0, 4])
  })
})

describe('오픈 판정 (0xa3a2~0xa46e)', () => {
  const 새저장 = normalizeAceOpenSave(null)

  it('가격은 XlsACE_LEVEL_UP row+0xa 다 — 0/6000/9000/12000', () => {
    expect(aceOpenPriceOf(1)).toBe(6000)
    expect(aceOpenPriceOf(2)).toBe(9000)
    expect(aceOpenPriceOf(3)).toBe(12000)
    // 레벨업 비용 표(0xd1724, 3000 부터)와 섞이지 않았는지 본다
    expect(aceOpenPriceOf(6)).toBe(6000)
  })

  it('G 가 가격보다 적으면 못 산다 (0xa3dc `blt`)', () => {
    expect(aceOpenAnswerOf(새저장, 1, 5999)).toBe('G부족')
  })

  it('가격과 딱 같으면 산다 — 원본은 `<` 로만 막는다', () => {
    expect(aceOpenAnswerOf(새저장, 1, 6000)).toBe('오픈')
  })

  it('칸 4(드래고나)·9(킹타이거)는 G 로 못 연다 — 0xa68e 가 칸 번호를 박아 두었다', () => {
    expect([...ACE_GAMEPOINT_LOCKED_CELLS]).toEqual([4, 9])
    expect(aceOpenAnswerOf(새저장, 4, 99999)).toBe('못여는칸')
    expect(aceOpenAnswerOf(새저장, 9, 99999)).toBe('못여는칸')
  })

  it('이미 열린 칸은 오픈 갈래로 안 간다 (0xa68a 가 레벨업 쪽으로 보낸다)', () => {
    expect(aceOpenAnswerOf(새저장, 0, 0)).toBe('이미열림')
  })
})

describe('플래그 세우기 (0xa3f6 `mgr[0x30 + cell] = 1`)', () => {
  it('그 칸만 켜고 나머지는 그대로다', () => {
    const 연뒤 = openAceCell(normalizeAceOpenSave(null), 3)

    expect(isAceCellOpen(연뒤, 3)).toBe(true)
    expect(isAceCellOpen(연뒤, 2)).toBe(false)
    expect(isAceCellOpen(연뒤, 0)).toBe(true)
  })

  it('저장을 다시 읽어도 열린 채다 (정규화가 안 지운다)', () => {
    const 연뒤 = openAceCell(normalizeAceOpenSave(null), 7)

    expect(isAceCellOpen(normalizeAceOpenSave(연뒤), 7)).toBe(true)
  })

  it('칸 밖이면 아무것도 안 한다', () => {
    const 새것 = normalizeAceOpenSave(null)

    expect(openAceCell(새것, -1)).toBe(새것)
    expect(openAceCell(새것, ACE_OPEN_CELL_COUNT)).toBe(새것)
  })
})
