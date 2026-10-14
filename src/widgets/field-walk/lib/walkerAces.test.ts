import { describe, expect, it } from 'vitest'
import { ACE_BATTER_DEFENDER_FRAMES, ACE_PITCHER_DEFENDER_FRAMES, DEFENDER_FRAMES } from '@/pages/defense/lib/defenseView'
import {
  aceRunnerBasesOf,
  benchOffenseAceSpritesOf,
  benchOffenseSeatsOf,
  seatsAfterBenchClearing,
} from '@/widgets/field-walk/lib/benchClearingFieldInput'
import { NEW_FIELD_WALKER } from '@/widgets/field-walk/lib/fieldWalker'
import {
  NEW_WALKER_LINE_SEATS,
  seatsAfterDefensePlay,
  seatsAfterHalfInningBoard,
  walkAceSpritesOf,
  walkerRecordsOf,
  walkerSpriteOf,
} from '@/widgets/field-walk/lib/walkerAces'

const plainRecords: { position: number; ace: number | null }[] = [2, 3, 4, 5, 6, 7, 8, 9, 1, 0, 0, 0].map((position) => ({ position, ace: null }))

describe('운동장 마선수 그림 0x43010 → 0x79b48', () => {
  it('a — 칸 0 은 줄 팀 지금 투수가 마투수면 투수 마선수 그림(프레임 날값)', () => {
    const sprites = walkAceSpritesOf({ pitcherAce: 3, records: plainRecords })
    expect(sprites[0]).toEqual({ kind: 'pitcher', index: 3 })
    expect(sprites.slice(1).every((sprite) => sprite === null)).toBe(true)
    expect(walkerSpriteOf(NEW_FIELD_WALKER, sprites[0])).toEqual({ folder: ACE_PITCHER_DEFENDER_FRAMES[3], frame: 0 })
    expect(walkerSpriteOf(NEW_FIELD_WALKER, null).folder).toBe(DEFENDER_FRAMES)
  })

  it('b — 칸의 +0xec(자리 니블 칸 + 1 인 첫 레코드)가 마타자면 그 팀 첫 마타자 그림', () => {
    const records = [...plainRecords]
    records[0] = { position: 2, ace: 4 }
    records[10] = { position: 0, ace: 1 }
    const sprites = walkAceSpritesOf({ pitcherAce: null, records })
    // 포수(니블 2 → 칸 1) 가 마타자 — 그 팀 첫 마타자(레코드 0, 번호 4)
    expect(sprites[1]).toEqual({ kind: 'batter', index: 4 })
    expect(walkerSpriteOf(NEW_FIELD_WALKER, sprites[1])).toEqual({ folder: ACE_BATTER_DEFENDER_FRAMES[4], frame: 0x11 })
  })

  it('칸 0 은 a 가 거짓이면 지명(니블 1) 레코드를 본다 — 지명이 마타자면 타자 마선수 그림(원본 그대로)', () => {
    const records = [...plainRecords]
    records[8] = { position: 1, ace: 2 }
    expect(walkAceSpritesOf({ pitcherAce: null, records })[0]).toEqual({ kind: 'batter', index: 2 })
    expect(walkAceSpritesOf({ pitcherAce: 0, records })[0]).toEqual({ kind: 'pitcher', index: 0 })
  })

  it('벤치 클리어링 공격 줄 — 마타자 지금 타자는 자기 칸 +0xec 를 타자(칸 8)와 맞바꾼다 (3a97e)', () => {
    const records = [...plainRecords]
    records[2] = { position: 4, ace: 0 }
    const team = { pitcherAce: null, records }
    expect(benchOffenseAceSpritesOf(team)[3]).toEqual({ kind: 'batter', index: 0 })
    const swapped = benchOffenseAceSpritesOf({ ...team, batter: { position: 4, ace: 0 } })
    expect(swapped[3]).toBeNull()
    expect(swapped[8]).toEqual({ kind: 'batter', index: 0 })
  })
})

describe('+0xec 남김 · 두 줄 따라가기 (0x3fac4 · 0xb0fb4 · 0x3a5f0)', () => {
  it('자리 니블이 맞는 레코드가 없는 칸은 앞 값을 남긴다 — 앞 값이 없으면(장면 막 세움) 0', () => {
    const noDesignated = plainRecords.map((record) => (record.position === 1 ? { position: 0, ace: null } : record))
    expect(walkerRecordsOf(noDesignated)[0]).toBeNull()
    const previous = [{ ace: 3 }, null, null, null, null, null, null, null, null]
    expect(walkerRecordsOf(noDesignated, previous)[0]).toEqual({ ace: 3 })
    // 칸 0 에 남은 마타자 레코드 — 줄 팀에 첫 마타자가 있으면 타자 마선수 그림(원본 그대로)
    const withAce = [...noDesignated, { position: 0, ace: 1 }]
    expect(walkAceSpritesOf({ pitcherAce: null, records: withAce }, previous)[0]).toEqual({ kind: 'batter', index: 1 })
    expect(walkAceSpritesOf({ pitcherAce: null, records: withAce })[0]).toBeNull()
  })

  it('교대 판은 두 줄을, 수비 판 시작은 수비 줄 칸 1..8 만 다시 훑는다', () => {
    const defense = plainRecords.map((record) => (record.position === 3 ? { ...record, ace: 2 } : record))
    const board = seatsAfterHalfInningBoard(NEW_WALKER_LINE_SEATS, defense, plainRecords)
    expect(board.defense[2]).toEqual({ ace: 2 })
    expect(board.defense[0]).toEqual({ ace: null })
    const other = plainRecords.map((record) => (record.position === 1 ? { ...record, ace: 4 } : record))
    const played = seatsAfterDefensePlay(board, other)
    // 칸 0 은 0xb0fb4 가 안 적는다 — 판의 지명 레코드가 남는다
    expect(played.defense[0]).toEqual({ ace: null })
    expect(played.defense[2]).toEqual({ ace: null })
    expect(played.offense).toBe(board.offense)
  })

  it('벤치 클리어링 — 니블 0 인 마선수(미션 마타자)는 O[−1] = [장면+0x1754] 와 맞바꿔 O[8] 이 쓰레기가 된다 (웹 0)', () => {
    const records = [...plainRecords, { position: 0, ace: 3 }]
    const team = { pitcherAce: null, records, batter: { position: 0, ace: 3 } }
    const seats = benchOffenseSeatsOf(team)
    expect(seats[8]).toBeNull()
    expect(seats.slice(0, 8).every((seat) => seat !== null)).toBe(true)
  })

  it('벤치 클리어링 — 마선수 주자 루 b 는 마선수 레코드 칸과 O[8 − b] 를 맞바꾼다 (3aa1a)', () => {
    const records = plainRecords.map((record) => (record.position === 5 ? { ...record, ace: 1 } : record))
    const aceRunnerBases = aceRunnerBasesOf({ second: 1 }, { first: false, second: true, third: false })
    expect(aceRunnerBases).toEqual([false, true, false])
    const sprites = benchOffenseAceSpritesOf({ pitcherAce: null, records, aceRunnerBases })
    expect(sprites[4]).toBeNull()
    expect(sprites[6]).toEqual({ kind: 'batter', index: 1 })
    const after = seatsAfterBenchClearing(NEW_WALKER_LINE_SEATS, { pitcherAce: null, records, aceRunnerBases })
    expect(after.defense).toBe(NEW_WALKER_LINE_SEATS.defense)
    expect(after.offense[6]).toEqual({ ace: 1 })
  })
})
