import { describe, expect, it } from 'vitest'
import {
  abilityGradeOf,
  canFireLaser,
  canRollSpecialDefense,
  isLaserWindowOpen,
  judgeLaserInput,
  laserThrowChanceOf,
  LASER_THROW_TABLE,
  rollLaserThrow,
  rollSpecialDefense,
  specialDefenseChanceOf,
  SPECIAL_DEFENSE_TABLE,
  LASER_WINDOW_FIRST_TICK,
  LASER_WINDOW_LAST_TICK,
  LASER_WINDOW_REAL_TICKS,
  LASER_WINDOW_TICKS,
} from '@/entities/defense-controls/model/laserThrow'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 0 ~ 999 를 차례로 내놓는 난수 — rand(0,1000) 의 결과를 그대로 지정한다 */
const 차례로 = (values: readonly number[]): RandomPort => {
  let index = 0
  return {
    next: () => (values[index++] ?? 0) / 1000,
    nextInRange: (minimum, maximum) => minimum + ((values[index++] ?? 0) / 1000) * (maximum - minimum),
    pick: (candidates) => candidates[0],
  }
}

/** 등급 g 한가운데를 고르는 능력치 (0xbbe98 문턱: 125·250·375·525·675·825·925) */
const 등급능력치: readonly number[] = [100, 200, 300, 500, 600, 800, 900, 999]

describe('능력치 → 등급 0~7 (0xbbe98)', () => {
  it('문턱 표', () => {
    const 표: ReadonlyArray<readonly [number, number]> = [
      [125, 0],
      [126, 1],
      [250, 1],
      [251, 2],
      [375, 2],
      [376, 3],
      [525, 3],
      [526, 4],
      [675, 4],
      [676, 5],
      [825, 5],
      [826, 6],
      [925, 6],
      [926, 7],
      [999, 7],
    ]
    표.forEach(([ability, grade]) => {
      expect(abilityGradeOf(ability), `능력치 ${ability}`).toBe(grade)
    })
  })
})

describe('필살수비 확률 — 표 0xd25b0 [1,2,3,3,4,4,5,6]', () => {
  it('등급별 한 번 굴림 기준은 표값 × 10 이다', () => {
    expect(SPECIAL_DEFENSE_TABLE).toEqual([1, 2, 3, 3, 4, 4, 5, 6])
    등급능력치.forEach((defenseAbility, grade) => {
      expect(specialDefenseChanceOf({ defenseAbility, skillIds: [], gameMode: 1 }), `등급 ${grade}`).toBe(
        SPECIAL_DEFENSE_TABLE[grade] * 10,
      )
    })
  })

  it('초감각(스킬 21)은 +3%p, 나만의리그 타자편(모드 4)은 절반이다', () => {
    expect(specialDefenseChanceOf({ defenseAbility: 100, skillIds: [21], gameMode: 1 })).toBe(40)
    expect(specialDefenseChanceOf({ defenseAbility: 100, skillIds: [21], gameMode: 4 })).toBe(20)
    expect(specialDefenseChanceOf({ defenseAbility: 100, skillIds: [], gameMode: 4 })).toBe(5)
  })

  it('A(점프)를 먼저 굴리고 실패했을 때만 B(슬라이딩)를 굴린다', () => {
    const 입력 = { defenseAbility: 999, skillIds: [], gameMode: 1 } // 등급 7 → 기준 60
    expect(rollSpecialDefense(입력, 차례로([59, 59]))).toBe('점프캐치')
    expect(rollSpecialDefense(입력, 차례로([60, 59]))).toBe('슬라이딩캐치')
    expect(rollSpecialDefense(입력, 차례로([60, 60]))).toBeNull()
  })

  it('홈런더비(모드 7)·투수·포수·이미 걸린 타구에서는 굴리지 않는다', () => {
    const 기본 = {
      gameMode: 1,
      isFairBattedBall: true,
      isPlayableState: true,
      hasSpecialDefenseThisBall: false,
      chaserSlot: 5,
    }
    expect(canRollSpecialDefense(기본)).toBe(true)
    expect(canRollSpecialDefense({ ...기본, gameMode: 7 })).toBe(false)
    expect(canRollSpecialDefense({ ...기본, isFairBattedBall: false })).toBe(false)
    expect(canRollSpecialDefense({ ...기본, isPlayableState: false })).toBe(false)
    expect(canRollSpecialDefense({ ...기본, hasSpecialDefenseThisBall: true })).toBe(false)
    expect(canRollSpecialDefense({ ...기본, chaserSlot: 0 })).toBe(false)
    expect(canRollSpecialDefense({ ...기본, chaserSlot: 1 })).toBe(false)
  })
})

describe('레이저 송구 확률 — 표 0xd2590 [3,4,5,6,7,8,9,10]', () => {
  it('등급별 기준은 표값 × 10 이고 모드 4 반감이 없다', () => {
    expect(LASER_THROW_TABLE).toEqual([3, 4, 5, 6, 7, 8, 9, 10])
    등급능력치.forEach((defenseAbility, grade) => {
      expect(laserThrowChanceOf({ defenseAbility, skillIds: [] }), `등급 ${grade}`).toBe(
        LASER_THROW_TABLE[grade] * 10,
      )
    })
    expect(laserThrowChanceOf({ defenseAbility: 100, skillIds: [21] })).toBe(60)
  })

  it('rand(0,1000) 이 기준보다 작으면 발동한다', () => {
    const 입력 = { defenseAbility: 100, skillIds: [] } // 등급 0 → 30
    expect(rollLaserThrow(입력, 차례로([29]))).toBe(true)
    expect(rollLaserThrow(입력, 차례로([30]))).toBe(false)
  })
})

describe('"반짝이는 순간" 창 — 0xb2648 (포구 −10 ~ +8틱)', () => {
  const 기본 = { hasChosenThrowTarget: false, isBallHeld: true, isThrowerReady: true }

  it('창은 공 잡기 10틱 **전**에 열려 19번 센다 (S12 3절 — 부호 정정)', () => {
    expect(LASER_WINDOW_TICKS).toBe(19)
    expect(LASER_WINDOW_FIRST_TICK).toBe(-10)
    expect(LASER_WINDOW_LAST_TICK).toBe(8)
    const 표: ReadonlyArray<readonly [number, boolean]> = [
      [-11, false],
      [-10, true],
      [0, true],
      [8, true],
      [9, false],
    ]
    표.forEach(([ticksSinceCatch, expected]) => {
      expect(isLaserWindowOpen({ ...기본, ticksSinceCatch }), `${ticksSinceCatch}틱`).toBe(expected)
    })
  })

  it('원본 버그 — 카운터가 틱당 2~3번 올라 실제 창은 7~9틱이다 (그대로 옮긴다)', () => {
    expect(LASER_WINDOW_REAL_TICKS).toEqual({ min: 7, max: 9 })
  })

  it('이미 목표를 고르고 공을 쥔 채 던질 준비가 끝났으면 창이 닫힌다', () => {
    expect(isLaserWindowOpen({ ...기본, ticksSinceCatch: 5, hasChosenThrowTarget: true })).toBe(false)
    // 셋 중 하나라도 빠지면 창은 그대로 열려 있다
    expect(
      isLaserWindowOpen({ ...기본, ticksSinceCatch: 5, hasChosenThrowTarget: true, isThrowerReady: false }),
    ).toBe(true)
  })
})

describe('반짝임 입력 판정 — 0x4e858', () => {
  it('반짝이는 동안 새로 누른 키 하나로 레이저가 확정된다', () => {
    expect(judgeLaserInput({ isShining: true, isWindowOpen: true, key: '6', isRepeat: false })).toEqual({
      isShining: true,
      isLaserConfirmed: true,
    })
  })

  it('누르고 있기(키 반복)로는 안 된다 — 원본 `this+0x6c & 0xf == 0`', () => {
    expect(judgeLaserInput({ isShining: true, isWindowOpen: true, key: '6', isRepeat: true })).toEqual({
      isShining: true,
      isLaserConfirmed: false,
    })
  })

  it('창이 닫히면 반짝임도 꺼진다', () => {
    expect(judgeLaserInput({ isShining: true, isWindowOpen: false, key: '6', isRepeat: false })).toEqual({
      isShining: false,
      isLaserConfirmed: false,
    })
  })

  it('키가 안 눌린 틱에는 아무 일도 없다', () => {
    expect(judgeLaserInput({ isShining: true, isWindowOpen: true, key: null, isRepeat: false })).toEqual({
      isShining: true,
      isLaserConfirmed: false,
    })
  })

  it('실제 발사는 목표·공 쥠·야수 준비가 모두 서야 한다 (0x400bc)', () => {
    const 기본 = {
      isLaserConfirmed: true,
      hasChosenThrowTarget: true,
      isBallHeld: true,
      isThrowerReady: true,
    }
    expect(canFireLaser(기본)).toBe(true)
    expect(canFireLaser({ ...기본, hasChosenThrowTarget: false })).toBe(false)
    expect(canFireLaser({ ...기본, isBallHeld: false })).toBe(false)
    expect(canFireLaser({ ...기본, isThrowerReady: false })).toBe(false)
    expect(canFireLaser({ ...기본, isLaserConfirmed: false })).toBe(false)
  })
})
