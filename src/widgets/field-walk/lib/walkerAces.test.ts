import { describe, expect, it } from 'vitest'
import { ACE_BATTER_DEFENDER_FRAMES, ACE_PITCHER_DEFENDER_FRAMES, DEFENDER_FRAMES } from '@/pages/defense/lib/defenseView'
import { benchOffenseAceSpritesOf } from '@/widgets/field-walk/lib/benchClearingFieldInput'
import { NEW_FIELD_WALKER } from '@/widgets/field-walk/lib/fieldWalker'
import { walkAceSpritesOf, walkerSpriteOf } from '@/widgets/field-walk/lib/walkerAces'

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
