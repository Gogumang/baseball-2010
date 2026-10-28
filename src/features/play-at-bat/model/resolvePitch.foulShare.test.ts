import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { resolvePitch } from '@/features/play-at-bat/model/resolvePitch'
import { createPatternDeck, isFairAngle } from '@/entities/batting/model/battedBallOutcome'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'
import { CPU_PITCH_TYPE_TICKS, cpuPitchAimOf, cpuPitchTypeTickOf, releaseCpuPitch } from '@/entities/pitching/model/selectPitch'
import { createCareer } from '@/entities/career/model/playerCareer'
import { effectiveAbilityOf } from '@/entities/career/model/condition'

/**
 * **사용자 신고 "나만의 리그 타자편에서 아무렇게나 쳐도 파울만 나온다"(좌타 · 경기 중간) 조사 — r361**.
 *
 * 맞은 공이 파울인지는 쏜 패턴의 각 하나로 갈린다(0x9d660 → `contactOfPattern`). 패턴 표에서 **모두 파울 각**인 결과 코드는
 * 9 · 10 · 11(약한 타구 중 `swing.foulPercent` 30% 갈래 + 방향)뿐이고, 강한 타구(15 · 18 · 24 계열)에는 파울 각이 없다.
 * 그래서 좌우 손 · 좌우 이동(±9) · 타이밍 · 투수 세기를 어떻게 골라도 **맞은 공 가운데 파울은 절반이 안 된다** — 판정이
 * 파울로만 쏠리는 조건은 타석 판정에 없다. 이 시험은 그 성질을 씨앗 고정으로 잡아 둔다(판정 쪽 회귀가 생기면 깨진다).
 */

const FOUL_ONLY_CODES = [9, 10, 11]

describe('파울만 나오는 조건이 타석 판정에 없다 (r361 신고 조사)', () => {
  it('패턴 표에서 모두 파울 각인 결과 코드는 9 · 10 · 11 뿐이다', () => {
    const allFoul = Object.entries(BATTED_BALL_PATTERNS)
      .filter(([, patterns]) => patterns.every((pattern) => !isFairAngle(pattern[0])))
      .map(([code]) => Number(code))
    expect(allFoul).toEqual(FOUL_ONLY_CODES)
  })

  const batter = effectiveAbilityOf(createCareer('측정'))
  const cases = [0, 1].flatMap((side) => [-9, 0, 9].flatMap((shift) => [-3, 0, 1].map((offset) => ({ side, shift, offset }))))

  it.each(cases)('손 $side · 이동 $shift · 키 틱 N − 2 + $offset — 페어 타구가 나오고 파울은 맞은 공의 절반 미만', ({ side, shift, offset }) => {
    const pitcher = { control: 100, velocity: 100 }
    const random = createSeededRandom(1000 + side * 100 + shift * 10 + offset)
    let deck = createPatternDeck(random)
    let foul = 0
    let fair = 0
    for (let n = 0; n < 400; n += 1) {
      const strikes = n % 3
      const situation = { strikes, balls: 0, outs: 0, runnerCount: 0, hasSecondBaseRunner: false, batterSide: side, side }
      const args = { pitcher, situation, difficulty: 'hard' as const, batterIntimidates: false }
      let typeNumber = 0
      for (let tick = 0; tick < CPU_PITCH_TYPE_TICKS; tick += 1) typeNumber = cpuPitchTypeTickOf(args, random)
      const aim = cpuPitchAimOf(args, random)
      if (aim.kind !== '목표') continue
      const pitch = releaseCpuPitch(args, typeNumber, aim.target, random).pitch
      const swingSituation = {
        inning: 6,
        isLosing: false,
        runnerCount: 0,
        hasSecondBaseRunner: false,
        pitcherSide: 0,
        batterSide: side,
        balls: 0,
        strikes,
        batterOrderIndex: 0,
        recentAtBatCodes: [],
      }
      const context = {
        batter,
        pitcher,
        mode: '나만의리그' as const,
        batterSkillIds: [],
        isBatterOwnPlayer: true,
        situation: swingSituation,
      }
      const resolved = resolvePitch(pitch, { frame: pitch.frameCount - 2 + offset, shift, buntKind: 0 }, context, deck, random)
      deck = resolved.deck
      if (resolved.detail.resolution.kind === '파울') foul += 1
      if (resolved.detail.resolution.kind === '타구') fair += 1
    }
    expect(fair).toBeGreaterThan(0)
    expect(foul / (foul + fair)).toBeLessThan(0.5)
  })
})
