import { describe, expect, it } from 'vitest'
import {
  acePitcherMirrorsOf, offenseTeamIdOf, pitcherMirrorOf, pitcherOutfitOf, pitcherRecolorFramesOf, runnerRecolorFramesOf, showsStrikeZone,
  stageWarmCastOf, strikeZoneAnchorOf,
} from '@/widgets/batting-stage/lib/renderBattingStage'
import { NO_EQUIPMENT, NO_PITCHER_EQUIPMENT, pitcherEquipmentOf, pitcherLayersOf } from '@/widgets/batting-stage/lib/batterLayers'
import { PITCHER_FRAMES } from '@/widgets/batting-stage/lib/spriteLoader'
import { RUNNER_FRAMES } from '@/widgets/batting-stage/lib/baseRunners'
import { pitcherFrameAt, pitcherPoseFramesOf } from '@/widgets/batting-stage/lib/stageScenery'
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

describe('미리 칠하기 목록 (r189 — 첫 와인드업 · 첫 주자 그림에 구운 벌이 비치지 않게)', () => {
  it('투수: 자세 전부의 등급 색 장비 겹을 등급 줄로 — 맨몸이면 칠할 겹이 없다', () => {
    expect(pitcherRecolorFramesOf(NO_PITCHER_EQUIPMENT).filter((frame) => frame.paletteIndex !== null)).toEqual([])
    const equipment = pitcherEquipmentOf({ control: 3, velocity: 3, breaking: 3, stamina: 3 })
    const frames = pitcherRecolorFramesOf(equipment)
    for (const pose of pitcherPoseFramesOf(null)) {
      for (const layer of pitcherLayersOf(pose, equipment)) {
        if (layer.gradePaletteRow === undefined) continue
        expect(frames).toContainEqual({ folder: layer.folder, frame: layer.frame, paletteIndex: layer.gradePaletteRow })
      }
    }
    expect(frames.some((frame) => frame.paletteIndex !== null)).toBe(true)
  })

  it('주자: 애니 0 · 1 · 2 의 칸을 한 번씩 공격 팀 벌로 (애니 3 부터는 루 주자가 아니다)', () => {
    const animations = [[{ frame: 0, delay: 1 }, { frame: 1, delay: 1 }], [{ frame: 1, delay: 1 }], [{ frame: 2, delay: 1 }], [{ frame: 9, delay: 1 }]]
    expect(runnerRecolorFramesOf(animations, 4)).toEqual([0, 1, 2].map((frame) => ({ folder: RUNNER_FRAMES, frame, paletteIndex: 4 })))
  })
})

describe('r193 — 마운드 투수 바탕 그림은 피부 × 15 + 수비 팀 (0x47cc8 482c0~482fc → 0x793b0 의 794c2)', () => {
  it('팀을 알면 바탕 pitcher.pzx 두 칸(f · f+22)을 피부 × 15 + 팀 벌로 칠한다', () => {
    const frames = pitcherRecolorFramesOf(NO_PITCHER_EQUIPMENT, { skinIndex: 2, teamIndex: 7 })
    const base = frames.filter((frame) => frame.folder === PITCHER_FRAMES)
    expect(base.length).toBeGreaterThan(0)
    expect(base.every((frame) => frame.paletteIndex === 2 * 15 + 7)).toBe(true)
  })

  it('장비 손 · 다리는 팀과 상관없이 등급 줄 그대로다', () => {
    const equipment = pitcherEquipmentOf({ control: 3, velocity: 3, breaking: 3, stamina: 3 })
    const withTeam = pitcherRecolorFramesOf(equipment, { skinIndex: 1, teamIndex: 4 }).filter((frame) => frame.folder !== PITCHER_FRAMES)
    expect(withTeam).toEqual(pitcherRecolorFramesOf(equipment).filter((frame) => frame.folder !== PITCHER_FRAMES))
  })

  it('팀을 안 넘긴 장면은 예전처럼 구운 벌(null) — 피부만으로는 칠하지 않는다', () => {
    expect(pitcherOutfitOf({})).toBeNull()
    expect(pitcherOutfitOf({ pitcherSkinIndex: 2, pitcherTeamIndex: null })).toBeNull()
    expect(pitcherOutfitOf({ pitcherTeamIndex: 3 })).toEqual({ skinIndex: 0, teamIndex: 3 })
  })
})

describe('r193 — 곧 설 선수 미리 칠하기 묶음 (`stageWarmCastOf`)', () => {
  it('같은 생김새는 한 벌만 남긴다', () => {
    const batter = { bodyType: 0, skinIndex: 1, teamIndex: 3, equipment: NO_EQUIPMENT }
    const pitcher = { skinIndex: 0, teamIndex: 3, equipment: NO_PITCHER_EQUIPMENT }
    const cast = stageWarmCastOf([batter, { ...batter }, { ...batter, skinIndex: 2 }], [pitcher, { ...pitcher }])
    expect(cast.batters).toHaveLength(2)
    expect(cast.pitchers).toHaveLength(1)
  })
})
