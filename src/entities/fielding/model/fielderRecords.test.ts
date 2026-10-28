import { describe, expect, it } from 'vitest'
import { fielderRecordsAfterBoard, fielderRecordsAtPlayStart, NEW_FIELDER_RECORDS } from '@/entities/fielding/model/fielderRecords'

/** 자리 니블 1..9 를 차례로 가진 아홉 명 + 벤치(니블 0) 하나 */
const lineupOf = (team: string) => [
  ...Array.from({ length: 9 }, (_unused, index) => ({ position: index + 1, name: `${team}${index}` })),
  { position: 0, name: `${team}벤치` },
]
const seatOf = (team: string) => (index: number) => `${team}:${index}`

describe('야수 +0xec 아홉 칸 — 교대 판 0x3fac4 · 판 시작 0xb0fb4', () => {
  it('장면 직후는 아홉 칸 모두 0 이고, 판 시작은 칸 0 을 찾지 않는다(b1032)', () => {
    expect(NEW_FIELDER_RECORDS).toEqual(Array.from({ length: 9 }, () => null))
    const seats = fielderRecordsAtPlayStart(undefined, lineupOf('A'), seatOf('A'))
    expect(seats[0]).toBeNull()
    // 칸 i 는 자리 니블 i + 1 — 칸 1(포수)은 니블 2 인 레코드 차례 1
    expect(seats.slice(1)).toEqual(['A:1', 'A:2', 'A:3', 'A:4', 'A:5', 'A:6', 'A:7', 'A:8'])
  })

  it('교대 판은 칸 0 에 니블 1(지명타자)을 넣고, 그 뒤 판 시작은 칸 0 을 그대로 둔다', () => {
    const board = fielderRecordsAfterBoard(undefined, lineupOf('A'), seatOf('A'))
    expect(board[0]).toBe('A:0')
    // 판 없이 반 이닝이 뒤집혀 B 가 수비 — 칸 1..8 만 B 로, 칸 0 은 A 의 지명타자가 남는다(원본 그대로)
    const play = fielderRecordsAtPlayStart(board, lineupOf('B'), seatOf('B'))
    expect(play[0]).toBe('A:0')
    expect(play[1]).toBe('B:1')
  })

  it('못 찾은 칸은 안 덮는다 — 앞 값이 남는다(3fee0 · b1062)', () => {
    const board = fielderRecordsAfterBoard(undefined, lineupOf('A'), seatOf('A'))
    const noDesignated = lineupOf('B').map((player) => (player.position === 1 ? { ...player, position: 0 } : player))
    expect(fielderRecordsAfterBoard(board, noDesignated, seatOf('B'))[0]).toBe('A:0')
    expect(fielderRecordsAfterBoard(undefined, noDesignated, seatOf('B'))[0]).toBeNull()
  })
})
