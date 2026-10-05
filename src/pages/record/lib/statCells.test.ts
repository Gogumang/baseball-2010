import { describe, expect, it } from 'vitest'
import { addGamePointEarned, EMPTY_ANNALS_STATS } from '@/entities/collection/model/annalsStats'
import {
  INITIAL_SECRET_CODE_STATE, statCellOf, statPageCellsOf, statTotalTextOf, statValueTextOf, typeSecretDigit,
} from '@/pages/record/lib/statCells'

/** 기록연감 통계 칸 0x7a08c · 비밀 번호 0x2b7a0 */
describe('통계 칸 번호 = 쪽 × 8 + 줄', () => {
  it('빈 번호(7 · 13~15 · 26~31 · 47 · 55)는 그리지 않는다', () => {
    for (const id of [7, 13, 14, 15, 26, 31, 47, 55]) expect(statCellOf(id)).toBeNull()
  })

  it('쪽마다 이름 번호가 원본 표대로다 — 투수 [159]·[160] 은 칸이 없다', () => {
    const names = (page: number) => statPageCellsOf(page).map((cell) => cell?.nameIndex ?? null)
    expect(names(0)).toEqual([129, 130, 131, 132, 133, 134, 135, null])
    expect(names(1)).toEqual([136, 137, 138, 139, 140, null, null, null])
    expect(names(3)).toEqual([149, 150, null, null, null, null, null, null])
    expect(names(4)).toEqual([151, 152, 153, 154, 155, 156, 157, 158])
    expect(names(5)).toEqual([161, 162, 163, 164, 165, 166, 167, null])
    expect(names(7)).toEqual([175, 176, 177, 178, 179, 180, 181, 182])
  })

  it('값 글은 %04d:%02d:%02d · %d회 · %d개 · %dG', () => {
    expect(statValueTextOf('시간', 3_723_999)).toBe('0001:02:03')
    expect(statValueTextOf('횟수', 3)).toBe('3회')
    expect(statValueTextOf('개수', 2)).toBe('2개')
    expect(statValueTextOf('G', 5000)).toBe('5000G')
  })

  it('칸 48~54 는 획득 GP 0x2325d(i) = +0x8c 칸 i 다', () => {
    const stats = addGamePointEarned(EMPTY_ANNALS_STATS, 120, 4)
    expect(statCellOf(49)?.valueOf(stats)).toBe(120)
    expect(statCellOf(48)?.valueOf(stats)).toBe(0)
  })

  it('합계는 쪽 6·7 만 — 0x58801(…, 6·7) 이 4·5 만 더해 늘 0G 다 (원본 버그)', () => {
    expect(statTotalTextOf(6)).toBe('0G')
    expect(statTotalTextOf(7)).toBe('0G')
    expect(statTotalTextOf(2)).toBeNull()
  })
})

describe('비밀 번호 1212123', () => {
  const typeAll = (keys: string) => [...keys].reduce(typeSecretDigit, INITIAL_SECRET_CODE_STATE)

  it('일곱 자리가 맞으면 열린다', () => {
    expect(typeAll('1212123').isUnlocked).toBe(true)
  })

  it('틀리면 센 수가 7 에 멈춰 더 쳐도 열리지 않는다', () => {
    const wrong = typeAll('1212124')
    expect(wrong).toMatchObject({ count: 7, isUnlocked: false })
    expect([...'1212123'].reduce(typeSecretDigit, wrong).isUnlocked).toBe(false)
  })

  it('숫자가 아닌 키는 세지 않는다', () => {
    expect(typeSecretDigit(INITIAL_SECRET_CODE_STATE, 'a')).toBe(INITIAL_SECRET_CODE_STATE)
  })
})
