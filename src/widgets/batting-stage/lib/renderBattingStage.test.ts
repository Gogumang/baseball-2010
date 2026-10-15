import { describe, expect, it } from 'vitest'
import { acePitcherMirrorsOf, offenseTeamIdOf, pitcherMirrorOf, showsStrikeZone, strikeZoneAnchorOf } from '@/widgets/batting-stage/lib/renderBattingStage'
import { pitcherFrameAt } from '@/widgets/batting-stage/lib/stageScenery'
import { pitcherHandOfPitch } from '@/entities/pitching/model/pitcherHand'

describe('타석 화면 일반 투수 — 폼·손 (0x9e0b8 · 0x482c8 · 0x79524)', () => {
  it('좌투(손 1)면 앵커 + 1 을 축으로 뒤집고, 우투는 그대로다', () => {
    expect(pitcherMirrorOf(240, 1)).toEqual({ axisX: 241, isMirrored: true })
    expect(pitcherMirrorOf(240, 0)).toEqual({ axisX: 240, isMirrored: false })
  })

  it('손은 0xb63c0 — 일반 투수는 폼 & 1, 마투수는 표대로', () => {
    expect(pitcherHandOfPitch({ pitcherForm: 3, pitcherMagicNumber: 0 })).toBe(1)
    expect(pitcherHandOfPitch({ pitcherForm: 2, pitcherMagicNumber: 0 })).toBe(0)
  })

  it('투구 단계 표는 폼 >> 1 로 갈린다 — 폼 2·3 은 같은 표, 0 과는 단계 6 에서 다르다', () => {
    const 단계6틱 = 11 // 단계 길이 dur+1 = 2·3·2·2·1·1 → 단계 6 은 틱 11 부터
    expect(pitcherFrameAt(2, 단계6틱)).toBe(pitcherFrameAt(3, 단계6틱))
    expect(pitcherFrameAt(2, 단계6틱)).not.toBe(pitcherFrameAt(0, 단계6틱))
  })
})

describe('존 표시 0x35ae8', () => {
  it('앵커 = 존 표 왼쪽 위 + (37 >> 1) − 2 — 프레임 원점 (−18, −18) 을 더하면 우타 (104, 238) · 좌타 (99, 238)', () => {
    expect(strikeZoneAnchorOf(0, { width: 37, height: 37 })).toEqual({ x: 122, y: 256 })
    expect(strikeZoneAnchorOf(1, { width: 37, height: 37 })).toEqual({ x: 117, y: 256 })
  })

  it('0xd · 0xe(대기 쉬는 동안) · 0x13(타격)에선 안 그린다', () => {
    expect(showsStrikeZone({ kind: '대기', tick: 0, isPaused: true })).toBe(false)
    expect(showsStrikeZone({ kind: '타격', tick: 0, isPaused: false })).toBe(false)
    expect(showsStrikeZone({ kind: '대기', tick: 3, isPaused: false })).toBe(true)
    expect(showsStrikeZone({ kind: '투구중', tick: 0, isPaused: false })).toBe(true)
    expect(showsStrikeZone({ kind: '결과', tick: 0, isPaused: false })).toBe(true)
    expect(showsStrikeZone(undefined)).toBe(true)
  })
})

describe('루상 주자 팔레트 — 공격 팀', () => {
  const hud = {
    inning: 1, half: '초', ourScore: 0, opponentScore: 0, balls: 0, strikes: 0, outs: 0,
    bases: { first: true, second: false, third: false }, ourLogoUrl: '', opponentLogoUrl: '', ourTeamId: 3, opponentTeamId: 7,
  }

  it('초 공격 = 측 0 — 사람이 후공(기본)이면 상대, 선공이면 우리 팀', () => {
    expect(offenseTeamIdOf(hud)).toBe(7)
    expect(offenseTeamIdOf({ ...hud, playerSide: 0 })).toBe(3)
    expect(offenseTeamIdOf({ ...hud, half: '말' })).toBe(3)
  })
})

describe('마투수 그림 뒤집기 — 0x79524 의 +0x3d == 2 갈래 (79570)', () => {
  it('bbmachine(순번 2)은 손을 안 보고 좌타 배치(1)에서만 뒤집는다 (38e82~38eac)', () => {
    expect([acePitcherMirrorsOf(2, false, 0), acePitcherMirrorsOf(2, true, 0)]).toEqual([false, false])
    expect([acePitcherMirrorsOf(2, false, 1), acePitcherMirrorsOf(2, true, 1)]).toEqual([true, true])
  })

  it('그 밖 마투수는 손(+0x3c)대로 — 좌투면 효과 0x11', () => {
    for (const order of [0, 1, 3, 4]) {
      expect([acePitcherMirrorsOf(order, true, 0), acePitcherMirrorsOf(order, false, 1)]).toEqual([true, false])
    }
  })
})
