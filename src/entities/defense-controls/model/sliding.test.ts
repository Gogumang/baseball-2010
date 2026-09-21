import { describe, expect, it } from 'vitest'
import {
  autoSlideRunnerIndexes,
  canSlide,
  runnerSpeedOf,
  slideOnKey,
  slidingSpeedOf,
  SLIDING_SPEED_BONUS,
  type SlidingRunner,
} from '@/entities/defense-controls/model/sliding'

const 주자 = (overrides: Partial<SlidingRunner> = {}): SlidingRunner => ({
  progressPercent: 80,
  isOut: false,
  isLeavingField: false,
  isSliding: false,
  targetBase: 1,
  ticksToArrive: 3,
  ...overrides,
})

describe('슬라이딩 구간 — 원본 0xa9690 (71 ≤ 진행률 ≤ 94)', () => {
  it('구간 표', () => {
    const 표: ReadonlyArray<readonly [number, boolean]> = [
      [0, false],
      [70, false],
      [71, true],
      [80, true],
      [94, true],
      [95, false],
      [100, false],
    ]
    표.forEach(([progressPercent, expected]) => {
      expect(canSlide(주자({ progressPercent })), `진행률 ${progressPercent}%`).toBe(expected)
    })
  })

  it('아웃된 주자는 구간 안이어도 안 걸린다', () => {
    expect(canSlide(주자({ progressPercent: 80, isOut: true }))).toBe(false)
  })

  it('슬라이딩 속도는 +40 이다 (0xa0164)', () => {
    expect(SLIDING_SPEED_BONUS).toBe(40)
    expect(slidingSpeedOf(335)).toBe(375)
  })

  it('주자 기본 속도 = 300 + ⌊주루 × 7 / 100⌋ (+팀 등급)', () => {
    expect(runnerSpeedOf(0)).toBe(300)
    expect(runnerSpeedOf(500)).toBe(335)
    expect(runnerSpeedOf(999)).toBe(369)
    expect(runnerSpeedOf(999, 7)).toBe(376)
  })
})

describe('OK 키 슬라이딩 — 원본 0x518da', () => {
  const 기본 = {
    playKind: 1,
    isFoulBattedBall: false,
    isSoundPlaying: false,
    hasPlayedSoundThisPlay: false,
  }

  it('구간 안 주자만 골라 슬라이딩시키고 효과음을 낸다', () => {
    const result = slideOnKey({
      ...기본,
      runners: [주자({ progressPercent: 50 }), 주자({ progressPercent: 71 }), 주자({ progressPercent: 94 })],
    })
    expect(result.slidRunnerIndexes).toEqual([1, 2])
    expect(result.playsSound).toBe(true)
  })

  // 앞서 0xb68dc 를 "경기 끝남" 으로 읽고 그 이름을 못박고 있었다.
  // CORRECTIONS.md 2절이 **"이 타구가 파울인가"**(결과 7 = 파울, 2스트라이크 번트면 11 = 아웃)로
  // 뒤집었으므로 이름과 뜻을 바로잡는다 — 막히는 상황이 "경기 끝" 이 아니라 **파울 타구**다.
  it('플레이 종류 2·3(볼넷 밀어내기 계열)과 파울 타구에서는 아무 일도 없다', () => {
    const runners = [주자()]
    expect(slideOnKey({ ...기본, playKind: 2, runners }).slidRunnerIndexes).toEqual([])
    expect(slideOnKey({ ...기본, playKind: 3, runners }).slidRunnerIndexes).toEqual([])
    expect(slideOnKey({ ...기본, isFoulBattedBall: true, runners }).slidRunnerIndexes).toEqual([])
  })

  it('아웃돼 걸어 나가는 주자가 하나라도 있으면 통째로 막힌다', () => {
    const result = slideOnKey({ ...기본, runners: [주자({ isLeavingField: true }), 주자()] })
    expect(result.slidRunnerIndexes).toEqual([])
  })

  it('두 번째 누름에서도 슬라이딩은 또 걸리고 효과음만 한 번이다 — 원본 그대로', () => {
    // 0x518da 가 잠금(+0x31c)을 0xa96ec **뒤**에 보기 때문이다. 버그로 보여도 원본 배치를 지킨다.
    const result = slideOnKey({ ...기본, hasPlayedSoundThisPlay: true, runners: [주자()] })
    expect(result.slidRunnerIndexes).toEqual([0])
    expect(result.playsSound).toBe(false)
  })

  it('효과음이 아직 울리는 중이면 소리만 건너뛴다', () => {
    const result = slideOnKey({ ...기본, isSoundPlaying: true, runners: [주자()] })
    expect(result.slidRunnerIndexes).toEqual([0])
    expect(result.playsSound).toBe(false)
  })
})

describe('자동 슬라이딩 — 원본 0xb030c', () => {
  const 기본 = { isThrowInFlight: true, throwTargetBase: 1, throwArrivalTicks: 5 }

  it('송구가 오는 루로 6틱 안에 닿는 구간 안 주자만 자동으로 슬라이딩한다', () => {
    expect(autoSlideRunnerIndexes({ ...기본, runners: [주자({ ticksToArrive: 6 })] })).toEqual([0])
    expect(autoSlideRunnerIndexes({ ...기본, runners: [주자({ ticksToArrive: 7 })] })).toEqual([])
  })

  it('송구 도착 예정과 ±9틱을 넘으면 안 건다', () => {
    expect(
      autoSlideRunnerIndexes({ ...기본, throwArrivalTicks: 15, runners: [주자({ ticksToArrive: 6 })] }),
    ).toEqual([0])
    expect(
      autoSlideRunnerIndexes({ ...기본, throwArrivalTicks: 16, runners: [주자({ ticksToArrive: 6 })] }),
    ).toEqual([])
  })

  it('송구가 날아가는 중이 아니거나 목표 루가 없으면(−1) 돌지 않는다', () => {
    expect(autoSlideRunnerIndexes({ ...기본, isThrowInFlight: false, runners: [주자()] })).toEqual([])
    expect(autoSlideRunnerIndexes({ ...기본, throwTargetBase: -1, runners: [주자()] })).toEqual([])
  })

  it('송구가 향하지 않는 루로 뛰는 주자와 이미 슬라이딩 중인 주자는 건너뛴다', () => {
    expect(autoSlideRunnerIndexes({ ...기본, runners: [주자({ targetBase: 2 })] })).toEqual([])
    expect(autoSlideRunnerIndexes({ ...기본, runners: [주자({ isSliding: true })] })).toEqual([])
  })
})
