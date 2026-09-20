import { describe, expect, it } from 'vitest'
import {
  DEFENSE_KEY_TABLE,
  inPlayCommandOf,
  originalKeyOf,
  pickoffCommandOf,
  type InPlayCommand,
} from '@/entities/defense-controls/model/defenseKeys'

describe('키 → 동작 표 — 원본 0x5331c · 0x533c8 · 0x53548', () => {
  it('진루는 2/4/8 이 1·2·3루 주자, 0 이 전원이다 (메시지 0x582)', () => {
    const 표: ReadonlyArray<readonly [string, InPlayCommand]> = [
      ['2', { kind: '진루', runner: 1 }],
      ['4', { kind: '진루', runner: 2 }],
      ['8', { kind: '진루', runner: 3 }],
      ['0', { kind: '진루', runner: '전원' }],
    ]
    표.forEach(([key, expected]) => {
      expect(inPlayCommandOf(key, '공격'), `키 ${key}`).toEqual(expected)
    })
  })

  it('귀루는 3/1/7 이 1·2·3루 주자, CLR 이 전원이다 (메시지 0x584)', () => {
    const 표: ReadonlyArray<readonly [string, InPlayCommand]> = [
      ['3', { kind: '귀루', runner: 1 }],
      ['1', { kind: '귀루', runner: 2 }],
      ['7', { kind: '귀루', runner: 3 }],
      ['Escape', { kind: '귀루', runner: '전원' }],
      ['Backspace', { kind: '귀루', runner: '전원' }],
    ]
    표.forEach(([key, expected]) => {
      expect(inPlayCommandOf(key, '공격'), `키 ${key}`).toEqual(expected)
    })
  })

  it('귀루 셋만 [+0x1c] & 0xf0 게이트를 탄다 — 막히면 전원 귀루(CLR)는 그대로 먹는다', () => {
    expect(inPlayCommandOf('3', '공격', { canReturn: false })).toBeNull()
    expect(inPlayCommandOf('1', '공격', { canReturn: false })).toBeNull()
    expect(inPlayCommandOf('7', '공격', { canReturn: false })).toBeNull()
    expect(inPlayCommandOf('Escape', '공격', { canReturn: false })).toEqual({ kind: '귀루', runner: '전원' })
  })

  it('송구는 홈 8 · 1루 6 · 2루 2 · 3루 4 다 (메시지 0x588)', () => {
    const 표: ReadonlyArray<readonly [string, number]> = [
      ['8', 0],
      ['6', 1],
      ['2', 2],
      ['4', 3],
    ]
    표.forEach(([key, target]) => {
      expect(inPlayCommandOf(key, '수비'), `키 ${key}`).toEqual({ kind: '송구', target })
    })
  })

  it('방향키는 숫자와 같은 칸을 누른 것으로 친다', () => {
    expect(inPlayCommandOf('ArrowUp', '공격')).toEqual(inPlayCommandOf('2', '공격'))
    expect(inPlayCommandOf('ArrowLeft', '공격')).toEqual(inPlayCommandOf('4', '공격'))
    expect(inPlayCommandOf('ArrowDown', '공격')).toEqual(inPlayCommandOf('8', '공격'))
    expect(inPlayCommandOf('ArrowDown', '수비')).toEqual(inPlayCommandOf('8', '수비'))
    expect(inPlayCommandOf('ArrowRight', '수비')).toEqual(inPlayCommandOf('6', '수비'))
  })

  it('같은 키라도 공격이면 주루, 수비면 송구다 — 원본이 [+0xc] 로 가른다', () => {
    expect(inPlayCommandOf('2', '공격')).toEqual({ kind: '진루', runner: 1 })
    expect(inPlayCommandOf('2', '수비')).toEqual({ kind: '송구', target: 2 })
  })

  it('OK(스페이스·Enter·5)는 슬라이딩이고, 수비 쪽에는 OK 갈래가 없다', () => {
    ;[' ', 'Enter', '5'].forEach((key) => {
      expect(inPlayCommandOf(key, '공격'), `키 ${key}`).toEqual({ kind: '슬라이딩' })
      expect(inPlayCommandOf(key, '수비'), `키 ${key}`).toBeNull()
    })
  })

  it('견제는 1루 3 · 2루 1 · 3루 7 이고 방향키 갈래가 없다 (메시지 0x10)', () => {
    expect(pickoffCommandOf('3')).toEqual({ kind: '견제', base: 1 })
    expect(pickoffCommandOf('1')).toEqual({ kind: '견제', base: 2 })
    expect(pickoffCommandOf('7')).toEqual({ kind: '견제', base: 3 })
    ;['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '2', '0', 'Escape'].forEach((key) => {
      expect(pickoffCommandOf(key), `키 ${key}`).toBeNull()
    })
  })

  it('표에 없는 키는 아무 동작도 아니다', () => {
    expect(inPlayCommandOf('a', '공격')).toBeNull()
    expect(inPlayCommandOf('9', '수비')).toBeNull()
    expect(originalKeyOf('Tab')).toBeNull()
  })

  it("숫자 '5' 는 원본에서도 OK 와 같은 키다", () => {
    expect(originalKeyOf('5')).toBe('OK')
  })

  it('표를 통째로 내보낸 사본도 같은 값이다', () => {
    expect(DEFENSE_KEY_TABLE.진루).toEqual({ '2': 1, 위: 1, '4': 2, 왼: 2, '8': 3, 아래: 3, '0': '전원' })
    expect(DEFENSE_KEY_TABLE.견제).toEqual({ '3': 1, '1': 2, '7': 3 })
    expect(DEFENSE_KEY_TABLE.슬라이딩).toBe('OK')
  })
})
